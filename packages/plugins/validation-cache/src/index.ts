import { getDocumentString, Plugin } from '@envelop/core';
import { GraphQLError, print, introspectionFromSchema, type GraphQLSchema } from 'graphql';
import jsonStableStringify from 'fast-json-stable-stringify';
import LRU from 'lru-cache';
import SHA1 from 'sha1-es';

export interface ValidationCache {
  /**
   * Get a result from the validation cache.
   */
  get(key: string): readonly GraphQLError[] | undefined;
  /**
   * Set a result to the validation cache.
   */
  set(key: string, value: readonly GraphQLError[]): void;
}

export type ValidationCacheOptions = {
  cache?: ValidationCache;
};

const DEFAULT_MAX = 1000;
const DEFAULT_TTL = 3600000;

const schemaHashCache = new WeakMap<GraphQLSchema, string>();

function getSchemaHash(schema: GraphQLSchema) {
  let hash = schemaHashCache.get(schema);
  if (hash) {
    return hash;
  }
  const introspection = introspectionFromSchema(schema);
  hash = SHA1.hash(jsonStableStringify(introspection.__schema));
  schemaHashCache.set(schema, hash);
  return hash;
}

export const useValidationCache = (pluginOptions: ValidationCacheOptions = {}): Plugin => {
  const resultCache =
    typeof pluginOptions.cache !== 'undefined'
      ? pluginOptions.cache
      : new LRU<string, readonly GraphQLError[]>({
          max: DEFAULT_MAX,
          maxAge: DEFAULT_TTL,
        });

  return {
    onValidate({ params, setValidationFn, validateFn }) {
      // We use setValidateFn over accessing params.rules directly, as other plugins in the chain might add more rules.
      // This would cause an issue if we are constructing the cache key here already.
      setValidationFn((...args) => {
        const schemaHashKey = getSchemaHash(args[0]);

        let ruleKey = '';
        if (Array.isArray(args[2])) {
          // Note: We could also order them... but that might be too much
          for (const rule of args[2]) {
            ruleKey = ruleKey + rule.name;
          }
        }

        const key: string = schemaHashKey + `|` + ruleKey + `|` + getDocumentString(params.documentAST, print);

        const cachedResult = resultCache.get(key);

        if (cachedResult !== undefined) {
          return cachedResult;
        }

        const result = validateFn(...args);
        resultCache.set(key, result);

        return result;
      });
    },
  };
};
