// The following is a schema definition for determining the sentiment of a some user input.

export type IVRAction = Say | Gather | Agent;

export interface Say {
  action: "say";
  text: string;
}

export interface Gather {
  action: "gather";
  text: string;
}

export interface Agent {
  action: "agent";
  skill: string;
}
