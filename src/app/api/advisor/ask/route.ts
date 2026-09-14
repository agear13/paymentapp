import { NextRequest } from 'next/server';

import { z } from 'zod';

import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';

import { answerPaymentAdvisorQuestion } from '@/lib/advisor/payment-advisor';

import { PAYMENT_ADVISOR_PRIORITIES } from '@/lib/advisor/payment-advisor-context';

import { PAYMENT_ADVISOR_DEMO_INTENTS } from '@/lib/advisor/payment-advisor-intents';

import { loadAdvisorIntelligenceContext } from '@/lib/advisor/load-advisor-intelligence.server';

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';

import { LANDING_TRANSACTION_TYPES } from '@/lib/journey/landing-route-model';



const paymentSchema = z.object({

  origin: z.string().optional(),

  destination: z.string().optional(),

  amount: z.number().positive().optional(),

  sourceCurrency: z.string().optional(),

  destinationCurrency: z.string().nullable().optional(),

  priority: z.enum(PAYMENT_ADVISOR_PRIORITIES).optional(),

  transactionType: z

    .enum(LANDING_TRANSACTION_TYPES.map((item) => item.id) as [string, ...string[]])

    .optional(),

});



const schema = z.object({

  intent: z

    .enum([

      'best_rail_recommendation',

      'explain_recommendation',

      'airwallex_scenario_comparison',

      'wise_rail_health',

    ])

    .optional(),

  question: z.string().max(500).optional(),

  payment: paymentSchema.optional(),

});



/** POST /api/advisor/ask — deterministic payment intelligence answers for workspace Advisor */

export async function POST(request: NextRequest) {

  const auth = await getCurrentUserForApi(request);

  if (!auth.user) return auth.response;



  const { data: body, error } = await validateBody(request, schema);

  if (error) return error;



  if (!body?.intent && !body?.question?.trim()) {

    return apiError('Provide an intent or question.', 400, 'MISSING_INPUT');

  }



  const intelligence = await loadAdvisorIntelligenceContext();

  const result = answerPaymentAdvisorQuestion({

    intent: body?.intent,

    question: body?.question,

    payment: body?.payment,

    intelligence,

  });



  if ('error' in result) {

    return apiResponse(

      {

        ok: false,

        error: result.error,

        supportedIntents: PAYMENT_ADVISOR_DEMO_INTENTS.map((item) => ({

          id: item.id,

          label: item.label,

        })),

      },

      200

    );

  }



  return apiResponse({

    ok: true,

    ...result,

  });

}


