import { is, check, object, createSetContextWarning } from './utils'
import { emitter } from './channel'
import { ident } from './utils'
import { runSaga } from './runSaga'

export default function sagaMiddlewareFactory({ context = {}, ...options } = {}) {
  const { sagaMonitor, logger, onError } = options

  if (is.func(options)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Saga middleware no longer accept Generator functions. Use sagaMiddleware.run instead')
    } else {
      throw new Error(
        `You passed a function to the Saga middleware. You are likely trying to start a\
        Saga by directly passing it to the middleware. This is no longer possible starting from 0.10.0.\
        To run a Saga, you must do it dynamically AFTER mounting the middleware into the store.
        Example:
          import createSagaMiddleware from 'redux-saga'
          ... other imports

          const sagaMiddleware = createSagaMiddleware()
          const store = createStore(reducer, applyMiddleware(sagaMiddleware))
          sagaMiddleware.run(saga, ...args)
      `,
      )
    }
  }

  if (logger && !is.func(logger)) {
    throw new Error('`options.logger` passed to the Saga middleware is not a function!')
  }

  if (process.env.NODE_ENV === 'development' && options.onerror) {
    throw new Error('`options.onerror` was removed. Use `options.onError` instead.')
  }

  if (onError && !is.func(onError)) {
    throw new Error('`options.onError` passed to the Saga middleware is not a function!')
  }

  if (options.emitter && !is.func(options.emitter)) {
    throw new Error('`options.emitter` passed to the Saga middleware is not a function!')
  }

  function sagaMiddleware({ getState, dispatch }) {
    // 一个事件订阅和发射器。 {subscribe, emmit}
    const sagaEmitter = emitter()
    // 重写sagaEmitter方法，将sagaEmitter.emmit作为方法参数，传到options.emitter方法里面
    // 生成一个接受action方法的方法，这个方法内部可以获原来的sagaEmitter.emitter方法
    // 并用于处理后来的action.
    sagaEmitter.emit = (options.emitter || ident)(sagaEmitter.emit)

  // 为runSaga方法绑定了参数
  // sagaMiddleware.run 现在为runSaga方法。
    sagaMiddleware.run = runSaga.bind(null, {
      context,
      subscribe: sagaEmitter.subscribe,
      // redux里面的dispatch方法被放到参数里面。
      dispatch,
      // redux里面的getState方法。
      getState,
      sagaMonitor,
      logger,
      onError,
    })
    // 返回一个方法接受next参数, 该方法返回一个方法，接受action参数。
    // 调用sagaMonitor.actionDispatched去处理action，
    // 带哦用next参数方法去处理action,
    // 调用sagaEmitter的emmit方法去处理action,
    return next => action => {
      if (sagaMonitor && sagaMonitor.actionDispatched) {
        sagaMonitor.actionDispatched(action)
      }
      const result = next(action) // hit reducers
      sagaEmitter.emit(action)
      // 返回一个action被下一个middleware调用
      return result
    }
  }

  // mount Saga前的提示.
  sagaMiddleware.run = () => {
    throw new Error('Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware')
  }

  sagaMiddleware.setContext = props => {
    check(props, is.object, createSetContextWarning('sagaMiddleware', props))
    object.assign(context, props)
  }

  return sagaMiddleware
}
