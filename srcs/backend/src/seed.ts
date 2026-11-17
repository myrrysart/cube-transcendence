import { PrismaClient } from '@prisma/client';
import { CHALLENGE_ID } from './rounds';

const db = new PrismaClient();
const geometry = {
  "challengeVersion": 2,
  "challengeId": "handoff-cube-01",
  "projection": "perspective",
  "referenceFaceId": "x:1",
  "edges": [
    {
      "id": "x:0:0",
      "role": "target",
      "points": [
        {
          "x": 0.5284,
          "y": 0.5602
        },
        {
          "x": 0.7227,
          "y": 0.6642
        }
      ]
    },
    {
      "id": "x:0:1",
      "role": "target",
      "points": [
        {
          "x": 0.5319,
          "y": 0.3205
        },
        {
          "x": 0.7625,
          "y": 0.3351
        }
      ]
    },
    {
      "id": "x:1:0",
      "role": "hidden",
      "points": [
        {
          "x": 0.3002,
          "y": 0.6255
        },
        {
          "x": 0.4464,
          "y": 0.8016
        }
      ]
    },
    {
      "id": "x:1:1",
      "role": "hidden",
      "points": [
        {
          "x": 0.2688,
          "y": 0.3295
        },
        {
          "x": 0.4324,
          "y": 0.3566
        }
      ]
    },
    {
      "id": "y:0:0",
      "role": "hidden",
      "points": [
        {
          "x": 0.5284,
          "y": 0.5602
        },
        {
          "x": 0.5319,
          "y": 0.3205
        }
      ]
    },
    {
      "id": "y:0:1",
      "role": "reference",
      "points": [
        {
          "x": 0.7227,
          "y": 0.6642
        },
        {
          "x": 0.7625,
          "y": 0.3351
        }
      ]
    },
    {
      "id": "y:1:0",
      "role": "hidden",
      "points": [
        {
          "x": 0.3002,
          "y": 0.6255
        },
        {
          "x": 0.2688,
          "y": 0.3295
        }
      ]
    },
    {
      "id": "y:1:1",
      "role": "reference",
      "points": [
        {
          "x": 0.4464,
          "y": 0.8016
        },
        {
          "x": 0.4324,
          "y": 0.3566
        }
      ]
    },
    {
      "id": "z:0:0",
      "role": "hidden",
      "points": [
        {
          "x": 0.5284,
          "y": 0.5602
        },
        {
          "x": 0.3002,
          "y": 0.6255
        }
      ]
    },
    {
      "id": "z:0:1",
      "role": "reference",
      "points": [
        {
          "x": 0.7227,
          "y": 0.6642
        },
        {
          "x": 0.4464,
          "y": 0.8016
        }
      ]
    },
    {
      "id": "z:1:0",
      "role": "hidden",
      "points": [
        {
          "x": 0.5319,
          "y": 0.3205
        },
        {
          "x": 0.2688,
          "y": 0.3295
        }
      ]
    },
    {
      "id": "z:1:1",
      "role": "reference",
      "points": [
        {
          "x": 0.7625,
          "y": 0.3351
        },
        {
          "x": 0.4324,
          "y": 0.3566
        }
      ]
    }
  ],
  "hitTolerance": 0.035,
  "completionThreshold": 0.8
};

void db.challenge.upsert({ where: { id: CHALLENGE_ID }, create: { id: CHALLENGE_ID, geometry }, update: {} })
  .then(() => console.log('Development challenge is available.'))
  .finally(() => db.$disconnect())
  .catch(() => { console.error('Challenge seed failed.'); process.exitCode = 1; });
