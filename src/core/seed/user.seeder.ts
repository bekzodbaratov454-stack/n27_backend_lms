import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { UserRoles } from "@prisma/client";
import * as argon from "argon2"

@Injectable()
export class UserSeeder implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        const adminPass = process.env.ADMIN_PASSWORD || "Admin1234!";
        const hashedPassword = await argon.hash(adminPass);

        const existUser = await this.prisma.user.findFirst({
            where: {
                phone: "+998975661099"
            }
        });

        if (existUser) {
            await this.prisma.user.update({
                where: { id: existUser.id },
                data: {
                    password: hashedPassword,
                    role: UserRoles.SUPERADMIN,
                },
            });
            Logger.log(`✅ SuperAdmin password updated successfully`);
        } else {
            await this.prisma.user.create({
                data: {
                    fullName: "Abduxoshim Sultonqulov",
                    phone: "+998975661099",
                    password: hashedPassword,
                    role: UserRoles.SUPERADMIN,
                },
            });

            Logger.log("✅ SuperAdmin Created");
        }
    }
}