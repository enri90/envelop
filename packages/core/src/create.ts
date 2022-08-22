import { GetEnvelopedFn, ComposeContext, Plugin, ArbitraryObject } from '@envelop/types';
import type { execute, parse, subscribe, validate } from 'graphql';
import { isPluginEnabled, PluginOrDisabledPlugin } from './enable-if.js';
import { createEnvelopOrchestrator, EnvelopOrchestrator } from './orchestrator.js';
import { traceOrchestrator } from './traced-orchestrator.js';

export function envelop<PluginsType extends Plugin<any>[]>(options: {
  plugins: Array<PluginOrDisabledPlugin>;
  enableInternalTracing?: boolean;
  parse: typeof parse;
  execute: typeof execute;
  validate: typeof validate;
  subscribe: typeof subscribe;
}): GetEnvelopedFn<ComposeContext<PluginsType>> {
  const plugins = options.plugins.filter(isPluginEnabled);
  let orchestrator = createEnvelopOrchestrator<ComposeContext<PluginsType>>({
    plugins,
    parse: options.parse,
    execute: options.execute,
    validate: options.validate,
    subscribe: options.subscribe,
  });

  if (options.enableInternalTracing) {
    orchestrator = traceOrchestrator(orchestrator);
  }

  const getEnveloped = <TInitialContext extends ArbitraryObject>(
    initialContext: TInitialContext = {} as TInitialContext
  ) => {
    const typedOrchestrator = orchestrator as EnvelopOrchestrator<TInitialContext, ComposeContext<PluginsType>>;
    typedOrchestrator.init(initialContext);

    return {
      parse: typedOrchestrator.parse(initialContext),
      validate: typedOrchestrator.validate(initialContext),
      contextFactory: typedOrchestrator.contextFactory(initialContext as any),
      execute: typedOrchestrator.execute,
      subscribe: typedOrchestrator.subscribe,
      schema: typedOrchestrator.getCurrentSchema(),
    };
  };

  getEnveloped._plugins = plugins;

  return getEnveloped as GetEnvelopedFn<ComposeContext<PluginsType>>;
}
