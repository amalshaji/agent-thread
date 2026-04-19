import { baseStyles } from "./base";
import { contentStyles } from "./content";
import { interactiveStyles } from "./interactive";
import { layoutStyles } from "./layout";
import { transcriptStyles } from "./transcript";

export const pageStyles = [baseStyles, layoutStyles, contentStyles, transcriptStyles, interactiveStyles].join("\n");
