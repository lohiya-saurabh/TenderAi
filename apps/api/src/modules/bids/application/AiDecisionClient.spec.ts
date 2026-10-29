import { describe, it, expect } from 'vitest';
import {
  AiDecisionClient,
  type AiBidDecisionRequest,
  type AiBidDecisionResponse,
} from '@/modules/bids/application/AiDecisionClient.js';

const request = { tender_id: 'bid-1' } as unknown as AiBidDecisionRequest;

describe('AiDecisionClient — the AI worker is the only decision engine', () => {
  it('returns the engine answer unchanged', async () => {
    const answer = { verdict: 'CONDITIONAL_GO' } as unknown as AiBidDecisionResponse;
    const client = new AiDecisionClient({
      customFetch: async () => ({ ok: true, status: 200, json: async () => answer }),
    });
    await expect(client.evaluate(request)).resolves.toBe(answer);
  });

  it('reports an unreachable engine as 503 instead of evaluating locally', async () => {
    const client = new AiDecisionClient({
      customFetch: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    await expect(client.evaluate(request)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('reports an engine error status as 503', async () => {
    const client = new AiDecisionClient({
      customFetch: async () => ({
        ok: false,
        status: 500,
        json: async () => ({}) as AiBidDecisionResponse,
      }),
    });
    await expect(client.evaluate(request)).rejects.toMatchObject({ statusCode: 503 });
  });
});
