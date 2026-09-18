import { Body, Controller, Param, ParseIntPipe, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/register")
  registerDefault(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("/register/:courseId")
  register(@Body() payload: RegisterDto, @Param('courseId', ParseIntPipe) courseId: number) {
    return this.authService.register(payload, courseId);
  }

  @Post("/login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }
}
