import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/database/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.categories.create({
      data: dto,
    });


    return {
      success: true,
      data: category,
    };
  }

  async findAll() {
    try {
      const categories = await this.prisma.categories.findMany({
        orderBy: { created_at: "desc" },
      });

      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      console.error('Categories findAll error:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    const category = await this.prisma.categories.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return {
      success: true,
      data: category,
    };
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const existing = await this.findOne(id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.categories.update({
      where: { id },
      data: dto,
    });

    return {
      success: true,
      data: updated,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.categories.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    // Check if category has courses
    const coursesCount = await this.prisma.courses.count({
      where: { categoryId: id }
    });

    if (coursesCount > 0) {
      throw new ConflictException(
        "Category has courses. First delete connected courses then delete category",
      );
    }

    await this.prisma.categories.delete({
      where: { id },
    });

    return {
      success: true,
    };
  }
}
