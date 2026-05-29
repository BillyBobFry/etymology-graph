<script setup lang="ts">
import { computed } from "vue";

import type { EtymologyGraph } from "@etymology-graph/graph";
import { graphCanvasHeight, graphCanvasWidth } from "./graphCanvasConstants";

const props = defineProps<{
  graph: EtymologyGraph;
}>();

const graphContourTransform = computed(() => contourTransformForGraph(props.graph));
const graphMapPlaneClass = "pointer-events-none opacity-[0.42]";
const graphMapContoursClass = "opacity-[0.3]";
const graphMapPathBaseClass = "fill-none [vector-effect:non-scaling-stroke]";
const graphMapGridMinorClass = `${graphMapPathBaseClass} stroke-[color-mix(in_oklch,var(--theme-border)_38%,transparent)] stroke-[0.8]`;
const graphMapGridMajorClass = `${graphMapPathBaseClass} stroke-[color-mix(in_oklch,var(--theme-border-strong)_28%,transparent)] stroke-[1]`;
const graphMapContourLineClass =
  `${graphMapPathBaseClass} stroke-[color-mix(in_oklch,var(--theme-borrowed)_34%,transparent)] stroke-[1] [stroke-dasharray:8_13] [stroke-linecap:round] [stroke-linejoin:round]`;
const graphMapIndexContourLineClass =
  `${graphMapPathBaseClass} stroke-[color-mix(in_oklch,var(--theme-ancestor)_28%,transparent)] stroke-[1.25] [stroke-dasharray:14_10] [stroke-linecap:round] [stroke-linejoin:round]`;

/** Keeps contour terrain deterministic per graph while avoiding a repeated background crop. */
function contourTransformForGraph(graph: EtymologyGraph): string {
  const graphHash = hashGraphIdentity(graph);
  const contourCenterX = 360;
  const contourCenterY = 260;
  const viewportCenterX = graphCanvasWidth / 2;
  const viewportCenterY = graphCanvasHeight / 2;
  const centerX = viewportCenterX - 720 + normalizedHashValue(graphHash, 0, 1440);
  const centerY = viewportCenterY - 560 + normalizedHashValue(graphHash, 8, 1120);
  const scale = 2.2 + normalizedHashValue(graphHash, 16, 0.55);
  const rotation = -18 + normalizedHashValue(graphHash, 24, 36);

  return [
    `translate(${centerX.toFixed(1)} ${centerY.toFixed(1)})`,
    `rotate(${rotation.toFixed(1)})`,
    `scale(${scale.toFixed(3)})`,
    `translate(${-contourCenterX} ${-contourCenterY})`
  ].join(" ");
}

/** Hashes stable graph identity fields so layout movement does not change the map texture. */
function hashGraphIdentity(graph: EtymologyGraph): number {
  const identity = [
    ...graph.nodes.map((node) => `n:${node.id}:${node.langCode}:${node.word}`),
    ...graph.edges.map((edge) => `e:${edge.id}:${edge.fromNodeId}:${edge.toNodeId}:${edge.type}`)
  ]
    .sort()
    .join("|");

  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/** Maps different bit windows from a hash into small visual transform ranges. */
function normalizedHashValue(hash: number, shift: number, range: number): number {
  return (((hash >>> shift) & 0xff) / 255) * range;
}
</script>

<template>
  <defs>
    <pattern id="graph-map-grid" width="160" height="160" patternUnits="userSpaceOnUse">
      <path :class="graphMapGridMinorClass" d="M 32 0 V 160 M 64 0 V 160 M 96 0 V 160 M 128 0 V 160 M 0 32 H 160 M 0 64 H 160 M 0 96 H 160 M 0 128 H 160" />
      <path :class="graphMapGridMajorClass" d="M 0 0 H 160 V 160 H 0 Z" />
    </pattern>
    <pattern id="graph-map-contours" width="1920" height="1560" patternUnits="userSpaceOnUse">
      <g :transform="graphContourTransform">
        <path
          :class="graphMapIndexContourLineClass"
          d="M 368 14 C 444 -8 504 24 573 72 C 646 123 669 183 635 249 C 615 288 664 318 626 370 C 588 422 510 417 462 438 C 411 461 384 514 318 514 C 268 514 240 548 183 498 C 126 448 109 387 121 334 C 133 281 90 260 126 203 C 162 145 141 95 211 70 C 263 51 304 110 326 60 C 337 36 344 21 368 14 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 364 50 C 430 33 485 61 543 102 C 603 145 621 193 594 247 C 577 281 615 307 584 350 C 553 393 491 389 449 406 C 407 424 379 468 324 469 C 281 470 257 498 210 457 C 164 415 150 365 159 321 C 169 278 135 259 164 213 C 193 166 178 126 236 105 C 279 89 311 139 331 96 C 341 75 344 56 364 50 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 360 82 C 416 68 466 89 515 125 C 566 164 582 202 559 246 C 545 276 574 297 548 333 C 522 369 471 366 435 381 C 398 396 372 434 326 436 C 289 438 269 460 230 426 C 191 393 180 350 188 313 C 196 277 168 261 192 222 C 216 184 202 151 250 134 C 286 122 314 163 332 128 C 342 108 343 87 360 82 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 359 108 C 407 97 450 115 492 146 C 535 178 548 213 530 250 C 517 276 541 294 519 324 C 497 354 454 351 424 363 C 392 376 368 408 328 410 C 298 412 282 431 249 402 C 217 374 208 338 214 306 C 221 275 197 262 218 230 C 239 198 227 171 267 157 C 298 146 318 182 334 152 C 343 135 344 112 359 108 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 356 138 C 398 130 433 145 469 174 C 504 203 516 231 501 262 C 490 284 509 299 490 325 C 471 351 436 348 410 359 C 383 370 363 396 330 398 C 303 399 290 415 262 392 C 235 368 228 337 233 311 C 238 284 218 272 236 245 C 253 219 244 195 278 183 C 303 174 321 203 336 178 C 345 163 344 142 356 138 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 354 165 C 390 158 421 171 450 195 C 481 219 489 244 476 271 C 468 289 482 302 466 324 C 450 345 420 343 399 351 C 376 360 358 382 330 385 C 307 387 295 400 273 380 C 250 361 244 335 248 313 C 253 290 236 280 250 258 C 265 236 258 216 287 206 C 308 199 323 222 337 202 C 347 187 344 169 354 165 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 353 187 C 386 182 413 193 437 213 C 462 234 470 255 459 278 C 451 294 463 305 449 323 C 435 341 411 340 391 347 C 372 355 356 374 331 376 C 313 378 302 389 283 372 C 265 356 260 333 263 314 C 267 295 253 286 265 268 C 277 249 272 234 296 225 C 315 218 327 239 339 221 C 347 207 344 190 353 187 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 352 207 C 379 202 403 212 423 230 C 445 248 451 267 442 287 C 436 301 445 310 434 325 C 422 340 401 339 385 346 C 368 353 355 368 333 371 C 317 373 308 382 292 368 C 276 354 272 335 275 318 C 278 302 266 294 277 278 C 287 263 283 250 303 243 C 319 237 329 255 341 239 C 348 228 344 210 352 207 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 351 228 C 375 224 394 232 411 247 C 429 263 433 278 426 295 C 421 306 429 314 419 327 C 409 339 392 338 378 344 C 363 350 353 363 335 366 C 322 367 314 375 301 364 C 287 352 284 336 286 322 C 289 308 279 301 288 288 C 296 275 293 264 310 258 C 323 254 332 268 342 255 C 348 245 344 231 351 228 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 349 248 C 368 245 384 252 397 264 C 409 275 423 280 414 298 C 408 311 410 322 398 330 C 385 338 375 327 361 336 C 350 343 350 356 337 359 C 325 361 320 348 309 356 C 299 362 298 343 297 330 C 296 318 289 309 299 298 C 309 287 303 280 316 275 C 327 271 334 283 342 273 C 347 265 344 250 349 248 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 321 281 C 331 276 342 282 350 289 C 361 299 354 309 349 318 C 343 330 331 323 323 329 C 313 336 309 319 307 310 C 304 298 309 286 321 281 Z"
        />
        <path
          :class="graphMapContourLineClass"
          d="M 381 283 C 395 279 405 290 411 300 C 417 312 405 320 397 327 C 388 335 381 322 371 321 C 361 320 363 304 368 295 C 371 288 374 285 381 283 Z"
        />
      </g>
    </pattern>
  </defs>
  <rect
    :class="graphMapPlaneClass"
    :x="-graphCanvasWidth"
    :y="-graphCanvasHeight"
    :width="graphCanvasWidth * 3"
    :height="graphCanvasHeight * 3"
    fill="url(#graph-map-grid)"
  />
  <rect
    :class="[graphMapPlaneClass, graphMapContoursClass]"
    :x="-graphCanvasWidth"
    :y="-graphCanvasHeight"
    :width="graphCanvasWidth * 3"
    :height="graphCanvasHeight * 3"
    fill="url(#graph-map-contours)"
  />
</template>
