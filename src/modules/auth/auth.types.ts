export type UserResponse = {
  id: number
  email: string
  name: string
}

export type AuthResponse = {
  user: UserResponse
  accessToken: string
  refreshToken: string
}

export type UserRequest = {
  email: string;
  password: string;
  name: string
}

export type ApiResponse<T> = { message: string; data: T }

