import { useCallback, useRef, useState } from "react";
import { Node, Edge } from "reactflow";

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useFlowHistory(initialNodes: Node[], initialEdges: Edge[]) {
  const history = useRef<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const pointer = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(pointer.current > 0);
    setCanRedo(pointer.current < history.current.length - 1);
  }, []);

  const pushState = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      const stack = history.current;
      // Trim future states
      if (pointer.current < stack.length - 1) {
        stack.splice(pointer.current + 1);
      }
      stack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
      if (stack.length > MAX_HISTORY) stack.shift();
      pointer.current = stack.length - 1;
      updateFlags();
    },
    [updateFlags]
  );

  const undo = useCallback((): HistoryState | null => {
    if (pointer.current <= 0) return null;
    pointer.current--;
    updateFlags();
    return JSON.parse(JSON.stringify(history.current[pointer.current]));
  }, [updateFlags]);

  const redo = useCallback((): HistoryState | null => {
    if (pointer.current >= history.current.length - 1) return null;
    pointer.current++;
    updateFlags();
    return JSON.parse(JSON.stringify(history.current[pointer.current]));
  }, [updateFlags]);

  return { pushState, undo, redo, canUndo, canRedo };
}
