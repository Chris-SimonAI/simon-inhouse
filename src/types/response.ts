export type CreateSuccess<T> = {
  ok: true;
  data: T;
};

type CreateErrorNoErrors = {
  ok: false;
  message: string;
};

type CreateErrorWithErrors<T> = {
  ok: false;
  message: string;
  errors: T;
};

export type CreateError<T = never> =
  | CreateErrorNoErrors
  | CreateErrorWithErrors<T>;