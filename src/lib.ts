export type Awaitable<T> = Promise<T> | T;

export type Point = [x: number, y: number];

export interface SokobanMap {
  width: number;
  height: number;
  wallSet: Set<string>;
  goalSet: Set<string>;
}

export interface SokobanState {
  player: Point;
  boxes: Point[];
  boxSet: Set<string>;
}

export function parseSokoban(
  input: string
): [map: SokobanMap, state: SokobanState] | null {
  const rows = input
    .split(/\r*\n/)
    .map((line) => line.trim())
    .filter((line) => line);
  const height = rows.length;
  if (!rows[0]) return null;
  const width = rows[0].length;
  if (rows.some((row) => row.length !== width)) return null;

  const walls: Point[] = [];
  const goals: Point[] = [];
  let player: Point | undefined;
  const boxes: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      switch (rows[y]![x]!) {
        case ".":
        case "b":
        case "w":
          break;
        case "#":
          walls.push([x, y]);
          break;
        case "+":
        case "B":
        case "W":
          goals.push([x, y]);
          break;
        default:
          return null;
      }
      switch (rows[y]![x]!) {
        case ".":
        case "+":
        case "#":
          break;
        case "w":
        case "W":
          player = [x, y];
          break;
        case "b":
        case "B":
          boxes.push([x, y]);
          break;
        default:
          return null;
      }
    }
  }
  if (!player) return null;

  const wallSet = new Set(walls.map(([x, y]) => `${x},${y}`));
  const reachable = Array.from(new Array(height)).map(() =>
    Array.from(new Array(width)).map(() => false)
  );
  (function floodFill(x: number, y: number) {
    if (wallSet.has(`${x},${y}`)) return;
    reachable[y]![x] = true;
    if (x > 0 && !reachable[y]![x - 1]!) floodFill(x - 1, y);
    if (x < width - 1 && !reachable[y]![x + 1]!) floodFill(x + 1, y);
    if (y > 0 && !reachable[y - 1]![x]!) floodFill(x, y - 1);
    if (y < height - 1 && !reachable[y + 1]![x]!) floodFill(x, y + 1);
  })(player[0], player[1]);
  if (boxes.some(([x, y]) => reachable[y]![x]! !== true)) return null;
  if (goals.some(([x, y]) => reachable[y]![x]! !== true)) return null;

  const goalSet = new Set(goals.map(([x, y]) => `${x},${y}`));
  const boxSet = new Set(boxes.map(([x, y]) => `${x},${y}`));
  boxes.sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  return [
    { width, height, wallSet, goalSet },
    { player, boxes, boxSet },
  ];
}

export async function solve(
  { width, height, wallSet, goalSet }: SokobanMap,
  initialState: SokobanState,
  onStep?: (state: SokobanState) => Awaitable<unknown>,
  onDistance?: (distance: number) => Awaitable<unknown>
): Promise<string | null> {
  function serializePoint([x, y]: Point) {
    return `${x},${y}`;
  }

  function deserializePoint(input: string): Point {
    const tmp = input.split(",");
    return [parseInt(tmp[0]!), parseInt(tmp[1]!)];
  }

  function serializeState({ player, boxes }: SokobanState): string {
    return [player, ...boxes].map((point) => serializePoint(point)).join("/");
  }

  function deserializeState(input: string): SokobanState {
    const [player, ...boxes] = input.split("/").map<Point>(deserializePoint);
    boxes.sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
    const boxSet = new Set(boxes.map(([x, y]) => serializePoint([x, y])));
    return { player: player!, boxes, boxSet };
  }

  function isInvalid({ boxSet }: SokobanState): boolean {
    for (let y = 1; y < height; y++) {
      for (let x = 1; x < width; x++) {
        if (
          (wallSet.has(serializePoint([x - 1, y - 1])) ||
            boxSet.has(serializePoint([x - 1, y - 1]))) &&
          (wallSet.has(serializePoint([x, y - 1])) ||
            boxSet.has(serializePoint([x, y - 1]))) &&
          (wallSet.has(serializePoint([x - 1, y])) ||
            boxSet.has(serializePoint([x - 1, y]))) &&
          (wallSet.has(serializePoint([x, y])) ||
            boxSet.has(serializePoint([x, y]))) &&
          ((!goalSet.has(serializePoint([x - 1, y - 1])) &&
            boxSet.has(serializePoint([x - 1, y - 1]))) ||
            (!goalSet.has(serializePoint([x, y - 1])) &&
              boxSet.has(serializePoint([x, y - 1]))) ||
            (!goalSet.has(serializePoint([x - 1, y])) &&
              boxSet.has(serializePoint([x - 1, y]))) ||
            (!goalSet.has(serializePoint([x, y])) &&
              boxSet.has(serializePoint([x, y]))))
        )
          return true;
        if (
          boxSet.has(serializePoint([x - 1, y - 1])) &&
          !goalSet.has(serializePoint([x - 1, y - 1])) &&
          wallSet.has(serializePoint([x, y - 1])) &&
          wallSet.has(serializePoint([x - 1, y]))
        )
          return true;
        if (
          boxSet.has(serializePoint([x, y - 1])) &&
          !goalSet.has(serializePoint([x, y - 1])) &&
          wallSet.has(serializePoint([x - 1, y - 1])) &&
          wallSet.has(serializePoint([x, y]))
        )
          return true;
        if (
          boxSet.has(serializePoint([x - 1, y])) &&
          !goalSet.has(serializePoint([x - 1, y])) &&
          wallSet.has(serializePoint([x, y])) &&
          wallSet.has(serializePoint([x - 1, y - 1]))
        )
          return true;
        if (
          boxSet.has(serializePoint([x, y])) &&
          !goalSet.has(serializePoint([x, y])) &&
          wallSet.has(serializePoint([x - 1, y])) &&
          wallSet.has(serializePoint([x, y - 1]))
        )
          return true;
      }
    }
    return false;
  }

  function nextState(
    { player, boxes, boxSet }: SokobanState,
    [x, y]: Point
  ): SokobanState | null {
    const nextX = player[0] + x;
    const nextY = player[1] + y;
    if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
      return null;
    if (wallSet.has(serializePoint([nextX, nextY]))) return null;
    if (boxSet.has(serializePoint([nextX, nextY]))) {
      const nextBoxX = nextX + x;
      const nextBoxY = nextY + y;
      if (wallSet.has(serializePoint([nextBoxX, nextBoxY]))) return null;
      if (boxSet.has(serializePoint([nextBoxX, nextBoxY]))) return null;
      const newBoxes = boxes.filter(([x, y]) => x !== nextX || y !== nextY);
      newBoxes.push([nextBoxX, nextBoxY]);
      newBoxes.sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
      const newBoxSet = new Set(
        newBoxes.map(([x, y]) => serializePoint([x, y]))
      );
      return { player: [nextX, nextY], boxes: newBoxes, boxSet: newBoxSet };
    }
    const result: SokobanState = { player: [nextX, nextY], boxes, boxSet };
    if (isInvalid(result)) return null;
    return result;
  }

  function isComplete({ boxes }: SokobanState) {
    return boxes.every(([x, y]) => goalSet.has(serializePoint([x, y])));
  }

  let distance = 0;
  const visited = new Map<string, string>([[serializeState(initialState), ""]]);
  let current: string[] = [serializeState(initialState)];
  while (current.length) {
    await onDistance?.(distance);
    const next: string[] = [];
    for (const serializedState of current) {
      const state = deserializeState(serializedState);
      const path = visited.get(serializedState);
      await onStep?.(state);
      const w = nextState(state, [0, -1]);
      if (w && !visited.has(serializeState(w))) {
        if (isComplete(w)) return `${path}W`;
        visited.set(serializeState(w), `${path}W`);
        next.push(serializeState(w));
      }
      const a = nextState(state, [-1, 0]);
      if (a && !visited.has(serializeState(a))) {
        if (isComplete(a)) return `${path}A`;
        visited.set(serializeState(a), `${path}A`);
        next.push(serializeState(a));
      }
      const s = nextState(state, [0, 1]);
      if (s && !visited.has(serializeState(s))) {
        if (isComplete(s)) return `${path}S`;
        visited.set(serializeState(s), `${path}S`);
        next.push(serializeState(s));
      }
      const d = nextState(state, [1, 0]);
      if (d && !visited.has(serializeState(d))) {
        if (isComplete(d)) return `${path}D`;
        visited.set(serializeState(d), `${path}D`);
        next.push(serializeState(d));
      }
    }
    current = next;
    distance++;
  }
  return null;
}
