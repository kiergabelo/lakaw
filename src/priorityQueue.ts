/**
 * StablePriorityQueue — a min-priority-queue backed by a binary heap, with
 * FIFO ordering on equal priorities via a monotonically increasing sequence
 * number tiebreaker.
 *
 * Extracted from Amping (https://amping.app) where it backs the A* transit
 * router. The stability contract is required so that A* explores ties in
 * insertion order — otherwise path suggestions drift between runs.
 *
 * O(log n) per enqueue/dequeue. No external dependencies.
 */

interface HeapNode<T> {
  item: T;
  priority: number;
  seq: number;
}

export class StablePriorityQueue<T> {
  private heap: HeapNode<T>[] = [];
  private seq = 0;

  enqueue(item: T, priority: number): void {
    const node: HeapNode<T> = { item, priority, seq: this.seq++ };
    this.heap.push(node);
    this.siftUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top.item;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  get size(): number {
    return this.heap.length;
  }

  peekPriority(): number | undefined {
    return this.heap[0]?.priority;
  }

  private less(a: HeapNode<T>, b: HeapNode<T>): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.seq < b.seq;
  }

  private siftUp(i: number): void {
    const item = this.heap[i]!;
    while (i > 0) {
      const parentIdx = (i - 1) >> 1;
      const parent = this.heap[parentIdx]!;
      if (this.less(item, parent)) {
        this.heap[i] = parent;
        i = parentIdx;
      } else {
        break;
      }
    }
    this.heap[i] = item;
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    const item = this.heap[i]!;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallestIdx = i;
      let smallest = item;
      if (left < n && this.less(this.heap[left]!, smallest)) {
        smallestIdx = left;
        smallest = this.heap[left]!;
      }
      if (right < n && this.less(this.heap[right]!, smallest)) {
        smallestIdx = right;
        smallest = this.heap[right]!;
      }
      if (smallestIdx === i) break;
      this.heap[i] = smallest;
      i = smallestIdx;
    }
    this.heap[i] = item;
  }
}
