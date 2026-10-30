import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

export const MAX_COMPLEXITY = 500;

/**
 * One GraphQL request can ask for a lot of work, so counting requests is not
 * enough. Each query gets a cost before it runs and expensive ones are rejected.
 */
@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  constructor(private readonly schemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const { schema } = this.schemaHost;

    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });
        if (complexity > MAX_COMPLEXITY) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${MAX_COMPLEXITY}`,
            { extensions: { code: 'QUERY_TOO_COMPLEX', complexity, http: { status: 400 } } },
          );
        }
      },
    };
  }
}
