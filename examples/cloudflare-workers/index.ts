import { envelop, useLogger, useSchema } from '@envelop/core';
import { parse, validate, execute, subscribe } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { getGraphQLParameters, processRequest, Response } from 'graphql-helix';
import { Router } from 'worktop';
import { listen } from 'worktop/cache';

const router = new Router();

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String!
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'World',
    },
  },
});

const getEnveloped = envelop({
  parse,
  validate,
  execute,
  subscribe,
  plugins: [useSchema(schema), useLogger()],
});

router.add('POST', '/graphql', async (req, res) => {
  const { parse, validate, contextFactory, execute, schema } = getEnveloped({ req });
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  const { operationName, query, variables } = getGraphQLParameters(request);
  const result = (await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
    parse,
    validate,
    execute,
    contextFactory,
  })) as Response<any, any>;

  res.send(
    result.status,
    result.payload,
    result.headers.reduce((prev, item) => ({ ...prev, [item.name]: item.value }), {})
  );
});
listen(router.run);
