import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, AuthUser } from './decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@weekly-arcade/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register or update user on first sign-in
   * Called after Firebase Auth sign-in on the frontend
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @CurrentUser() authUser: AuthUser,
    @Body() createUserDto: CreateUserDto
  ): Promise<User> {
    return this.authService.createOrUpdateUser(authUser.uid, createUserDto);
  }

  /**
   * Get current authenticated user's profile
   */
  @Get('me')
  async getMe(@CurrentUser() authUser: AuthUser): Promise<User> {
    const user = await this.authService.getUser(authUser.uid);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Delete user account and all associated data
   */
  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() authUser: AuthUser): Promise<void> {
    await this.authService.deleteUser(authUser.uid);
  }
}
