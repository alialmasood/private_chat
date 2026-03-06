/**
 * نوع المستخدم - جاهز للربط مع قاعدة البيانات لاحقاً
 */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export type UserCreate = Pick<User, "username" | "email"> & { password: string };
