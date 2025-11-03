import { z } from 'zod';

export const cardPaymentFormSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  fullName: z.string().min(1, "Full name is required"),
  nameOnCard: z.string().min(1, "Name on card is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(7, "Phone number is required"),
});

export type CardPaymentForm = z.infer<typeof cardPaymentFormSchema>;

export const validateCardPayment = (data: unknown) => {
  return cardPaymentFormSchema.safeParse(data);
};

export const validateRoomNumber = (value: string) => {
  const result = z.string().min(1, "Room number is required").safeParse(value);
  return result.success ? null : result.error.errors[0]?.message;
};

export const validateFullName = (value: string) => {
  const result = z.string().min(1, "Full name is required").safeParse(value);
  return result.success ? null : result.error.errors[0]?.message;
};

export const validateNameOnCard = (value: string) => {
  const result = z.string().min(1, "Name on card is required").safeParse(value);
  return result.success ? null : result.error.errors[0]?.message;
};

export const validateEmail = (value: string) => {
  const result = z.string().email("Valid email is required").safeParse(value);
  return result.success ? null : result.error.errors[0]?.message;
};

export const validatePhoneNumber = (value: string) => {
  const result = z.string().min(7, "Phone number is required").safeParse(value);
  return result.success ? null : result.error.errors[0]?.message;
};
