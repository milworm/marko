import { types as t } from "@marko/babel-types";
import { getTagDef } from "@marko/babel-utils";
import markoModules from "../../../modules";
import { enter, exit } from "../util/plugin-hooks";

/**
 * Applies custom transformers on tags.
 */
export const visitor = {
  Program(path) {
    path.hub.file._componentDefIdentifier = path.scope.generateUidIdentifier(
      "component"
    );
  },
  MarkoTag: {
    enter(path) {
      const transformers = getTransformersForTag(path);
      const { node } = path;

      for (const transformer of transformers) {
        enter(transformer, path, t);
        if (path.node !== node) break; // Stop if node is replaced.
      }
    },
    exit(path) {
      const transformers = getTransformersForTag(path);
      const { node } = path;

      for (const transformer of transformers) {
        exit(transformer, path, t);
        if (path.node !== node) break; // Stop if node is replaced.
      }
    }
  }
};

function getTransformersForTag(path) {
  const {
    hub: { file }
  } = path;
  const tagName = path.get("name.value").node || "*";
  const TRANSFORMER_CACHE = (file.TRANSFORMER_CACHE =
    file.TRANSFORMER_CACHE || Object.create(null));

  let transformers = TRANSFORMER_CACHE[tagName];

  if (!transformers) {
    transformers = TRANSFORMER_CACHE[tagName] = [];
    const addTransformers = tagDef => {
      if (tagDef) {
        for (const transformerPath in tagDef.transformers) {
          file._watchFiles.add(transformerPath);
          transformers.push(tagDef.transformers[transformerPath]);
        }
      }
    };

    addTransformers(getTagDef(path));

    if (tagName !== "*") {
      addTransformers(file.getTagDef("*"));
    }

    for (let i = 0; i < transformers.length; i++) {
      transformers[i] = markoModules.require(transformers[i].path);
    }

    transformers.sort(comparePriority);
  }

  return transformers;
}

function comparePriority(a, b) {
  a = a.priority || 0;
  b = b.priority || 0;

  return a - b;
}
