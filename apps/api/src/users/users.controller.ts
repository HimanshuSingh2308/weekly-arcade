import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto, UpdateSettingsDto, AddFriendDto } from './dto';
import { User, UserSettings } from '@weekly-arcade/shared';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user's profile
   */
  @Get('profile')
  async getProfile(@CurrentUser() authUser: AuthUser): Promise<User> {
    return this.usersService.getProfile(authUser.uid);
  }

  /**
   * Update current user's profile
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser() authUser: AuthUser,
    @Body() updateDto: UpdateUserDto
  ): Promise<User> {
    return this.usersService.updateProfile(authUser.uid, updateDto);
  }

  /**
   * Update user settings
   */
  @Put('settings')
  async updateSettings(
    @CurrentUser() authUser: AuthUser,
    @Body() settingsDto: UpdateSettingsDto
  ): Promise<UserSettings> {
    return this.usersService.updateSettings(authUser.uid, settingsDto);
  }

  /**
   * Get user's friends list
   */
  @Get('friends')
  async getFriends(@CurrentUser() authUser: AuthUser): Promise<User[]> {
    return this.usersService.getFriends(authUser.uid);
  }

  /**
   * Add a friend
   */
  @Post('friends')
  @HttpCode(HttpStatus.OK)
  async addFriend(
    @CurrentUser() authUser: AuthUser,
    @Body() addFriendDto: AddFriendDto
  ): Promise<string[]> {
    return this.usersService.addFriend(authUser.uid, addFriendDto.friendUid);
  }

  /**
   * Remove a friend
   */
  @Delete('friends/:friendUid')
  @HttpCode(HttpStatus.OK)
  async removeFriend(
    @CurrentUser() authUser: AuthUser,
    @Param('friendUid') friendUid: string
  ): Promise<string[]> {
    return this.usersService.removeFriend(authUser.uid, friendUid);
  }
}
