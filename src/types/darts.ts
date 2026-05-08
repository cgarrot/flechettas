export type NumberSegment =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;

export type BullSegment = 25 | 50;

export type Segment = NumberSegment | BullSegment;

export type Multiplier = 1 | 2 | 3;

export type PlayerId = string;

export type TurnId = string;

export type DartIndex = 0 | 1 | 2;

export type NumberDart = {
  segment: NumberSegment;
  multiplier: Multiplier;
};

export type SingleBullDart = {
  segment: 25;
  multiplier: 1;
};

export type BullseyeDart = {
  segment: 50;
  multiplier: 1;
};

export type MissDart = {
  miss: true;
  segment?: never;
  multiplier?: never;
};

export type Dart = NumberDart | SingleBullDart | BullseyeDart | MissDart;

// A turn contains up to three darts; validation enforces the max.
export type Turn = readonly Dart[];

export type DartTarget = {
  segment: Segment;
  multiplier?: Multiplier;
};

export type SegmentScore = {
  segment: Segment;
  score: number;
};
