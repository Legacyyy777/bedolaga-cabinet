import type Sigma from 'sigma';
import type Graph from 'graphology';

/**
 * We store sigma and graph instances on a module-level variable
 * so that search and controls can access them without prop drilling.
 */
let sigmaInstance: Sigma | null = null;
let graphInstance: Graph | null = null;

export function setSigmaInstance(sigma: Sigma | null): void {
  sigmaInstance = sigma;
}

export function getSigmaInstance(): Sigma | null {
  return sigmaInstance;
}

export function setGraphInstance(graph: Graph | null): void {
  graphInstance = graph;
}

export function getGraphInstance(): Graph | null {
  return graphInstance;
}
