type CreateSuccessNoMessage<T> = {
  ok: true;
  data: T;
};

type CreateSuccessWithMessage<T> = {
  ok: true;
  data: T;
  message: string;
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

export type CreateSuccess<T> = CreateSuccessNoMessage<T> | CreateSuccessWithMessage<T>;