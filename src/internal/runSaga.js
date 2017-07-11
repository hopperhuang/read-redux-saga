import { is, check, uid as nextSagaId, wrapSagaDispatch, noop, log } from './utils'
import proc from './proc'

const RUN_SAGA_SIGNATURE = 'runSaga(storeInterface, saga, ...args)'
const NON_GENERATOR_ERR = `${RUN_SAGA_SIGNATURE}: saga argument must be a Generator function!`

export function runSaga(storeInterface, saga, ...args) {
  let iterator

  if (is.iterator(storeInterface)) {
    if (process.env.NODE_ENV === 'development') {
      log('warn', `runSaga(iterator, storeInterface) has been deprecated in favor of ${RUN_SAGA_SIGNATURE}`)
    }
    iterator = storeInterface
    storeInterface = saga
  } else {
    check(saga, is.func, NON_GENERATOR_ERR)
    iterator = saga(...args)
    check(iterator, is.iterator, NON_GENERATOR_ERR)
  }

  const { subscribe, dispatch, getState, context, sagaMonitor, logger, onError } = storeInterface

  const effectId = nextSagaId()

  if (sagaMonitor) {
    // monitors are expected to have a certain interface, let's fill-in any missing ones
    // {effectId, parentEffectId, label, effect}作用参数
    sagaMonitor.effectTriggered = sagaMonitor.effectTriggered || noop
    //{effectId, result} result就是task
    sagaMonitor.effectResolved = sagaMonitor.effectResolved || noop
    // effectId, error
    sagaMonitor.effectRejected = sagaMonitor.effectRejected || noop
    // effectId
    sagaMonitor.effectCancelled = sagaMonitor.effectCancelled || noop
    // action
    sagaMonitor.actionDispatched = sagaMonitor.actionDispatched || noop

    sagaMonitor.effectTriggered({ effectId, root: true, parentEffectId: 0, effect: { root: true, saga, args } })
  }
  // 用process方法去处理iterator等参数，返回一个task对象。
  const task = proc(
    iterator,
    subscribe,
    wrapSagaDispatch(dispatch),
    getState,
    context,
    { sagaMonitor, logger, onError },
    effectId,
    // 方法名字.
    saga.name,
  )

  if (sagaMonitor) {
    sagaMonitor.effectResolved(effectId, task)
  }

  return task
}
