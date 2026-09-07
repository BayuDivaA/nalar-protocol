import { z } from 'zod'

export const transactionRequestSchema = z.object({
    chainId: z
        .number()
        .int()
        .positive(),

    from: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/),

    to: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/),

    value: z
        .string()
        .regex(/^\d+$/),

    data: z
        .string()
        .regex(/^0x([a-fA-F0-9]{2})*$/)
        .default('0x'),
})

export type TransactionRequest = z.infer<
    typeof transactionRequestSchema
>