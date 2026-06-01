export type GraphAnnotationTone = "shifted" | "unchanged" | "context";

export type GraphAnnotationPlacement = "above-left" | "above-right" | "below-left" | "below-right";

export type GraphNodeAnnotationTarget = {
  langCode: string;
  word: string;
};

export type GraphNodeAnnotation = {
  id: string;
  target: GraphNodeAnnotationTarget;
  additionalTargets?: GraphNodeAnnotationTarget[];
  fallbackTargets?: GraphNodeAnnotationTarget[];
  tone: GraphAnnotationTone;
  title: string;
  body: string;
  placement?: GraphAnnotationPlacement;
};
