import { test } from 'bun:test';
import { resetDb } from './_utils.js';

test('createReservation returns id and computes requires_approval', async () => {
    await resetDb();
    const { createReservation } = await import('../src/models/stockReservation.js');

    const rSmall = createReservation(1, 1, 'tester', 'small');
    if (!rSmall || !rSmall.id) throw new Error('expected id on small reservation');
    if (Number(rSmall.requires_approval) !== 0) throw new Error('expected small reservation to not require approval');

    const rLarge = createReservation(1, 100, 'tester', 'large');
    if (!rLarge || !rLarge.id) throw new Error('expected id on large reservation');
    if (Number(rLarge.requires_approval) !== 1) throw new Error('expected large reservation to require approval');
});
