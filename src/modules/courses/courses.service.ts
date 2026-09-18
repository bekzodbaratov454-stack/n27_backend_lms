import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { UpdateCourseDto } from "./dto/update-course.dto";
import * as fs from "fs/promises";
import { CourseFiles } from "./courses.controller";
import { UserRoles } from "@prisma/client";

export interface Current {
  id: number;
  role: UserRoles;
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(page = 1, limit = 10) {
    try {
      return this.prisma.courses.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { categories: true, sections: true },
        orderBy: { created_at: "desc" },
      });
    } catch (error) {
      console.error('Courses findAll error:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    const course = await this.prisma.courses.findUnique({
      where: { id },
      include: { categories: true, sections: true },
    });

    if (!course) throw new NotFoundException(`Kurs topilmadi (id: ${id})`);

    return course;
  }

  async create(dto: CreateCourseDto, files: CourseFiles, user: Current) {
    const bannerFile = files.banner?.[0];
    const introVideoFile = files.introVideo?.[0];

    if (!bannerFile) {
      throw new BadRequestException("Banner file is required");
    }

    try {
      const category = await this.prisma.categories.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Kategoriya topilmadi (id: ${dto.categoryId})`,
        );
      }

      const { banner, introVideo, ...rest } = dto;

      return await this.prisma.courses.create({
        data: {
          ...rest,
          teacherId: user.id,
          banner: `/uploads/banners/${bannerFile.filename}`,
          introVideo: introVideoFile
            ? `/uploads/videos/${introVideoFile.filename}`
            : null,
        },
        include: {
          categories: true,
          sections: true,
        },
      });
    } catch (error) {
      await this.deleteUploadedFiles([bannerFile, introVideoFile]);
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateCourseDto,
    files: CourseFiles,
    user: Current,
  ) {
    const existing = await this.findOne(id);
    const bannerFile = files?.banner?.[0];
    const introVideoFile = files?.introVideo?.[0];

    try {
      if (dto.categoryId) {
        const category = await this.prisma.categories.findUnique({
          where: { id: dto.categoryId },
        });
        if (!category) {
          throw new NotFoundException(
            `Category not found (id: ${dto.categoryId})`,
          );
        }
      }

      const { banner, introVideo, ...rest } = dto;

      const updated = await this.prisma.courses.update({
        where: { id },
        data: {
          ...rest,
          teacherId: user.id,
          ...(bannerFile && {
            banner: `/uploads/banners/${bannerFile.filename}`,
          }),
          ...(introVideoFile && {
            introVideo: `/uploads/videos/${introVideoFile.filename}`,
          }),
        },
        include: {
          categories: true,
          sections: true,
        },
      });

      const oldPaths: string[] = [];
      if (bannerFile && existing.banner) {
        oldPaths.push(`.${existing.banner}`);
      }
      if (introVideoFile && existing.introVideo) {
        oldPaths.push(`.${existing.introVideo}`);
      }
      if (oldPaths.length) {
        await this.deleteFilesByPath(oldPaths);
      }

      return updated;
    } catch (error) {
      await this.deleteUploadedFiles([bannerFile, introVideoFile]);
      throw error;
    }
  }

  async remove(id: number) {
    const existing = await this.findOne(id);

    try {
      return await this.prisma.courses.delete({
        where: { id },
      });
    } catch (error) {
      throw new ConflictException(
        "Bu kursni o'chirish mumkin emas, unga bog'liq ma'lumotlar mavjud",
      );
    }
  }

  private async deleteUploadedFiles(
    files: (Express.Multer.File | undefined)[],
  ) {
    await Promise.all(
      files
        .filter((f): f is Express.Multer.File => !!f?.path)
        .map((f) =>
          fs
            .unlink(f.path)
            .catch((err) =>
              console.error(`Faylni o'chirib bo'lmadi: ${f.path}`, err.message),
            ),
        ),
    );
  }
  private async deleteFilesByPath(paths: string[]) {
    await Promise.all(
      paths.map((filePath) =>
        fs
          .unlink(filePath)
          .catch((err) =>
            console.error(
              `Eski faylni o'chirib bo'lmadi: ${filePath}`,
              err.message,
            ),
          ),
      ),
    );
  }
}
