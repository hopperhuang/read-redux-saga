源码阅读顺序

1. middleware.js
2. runSaga.js
3. proc.js
4. channel.js
5. io.js

middleware --> 修改了dispatch方法
runsaga --> 调用proc
proc --> 启动rootSaga协程,并根据协程每一步的值选择不同的resolver,
                          将next方法(maintTask的next)让其去操作 --> 值为take的时候 调用channel --> io
                                                              --> 值为fork --> proc 新开协程
                                                              --> 值为call --> 视情况新开携程，并将上级mainTast的next传入，
                                                                               子协程结束则调用next继续主maintask
                                                              .... 一致调用next方法处理rootSaga，直到done
chanel --> 将上级携程执行器放到task 任务池里面

6. chanel 运作机制
emmit --(action)--> subscriptions --(action)-->chanel.put(action)---> task(action) <--- chanle.take <--- stdchanel <---proc <--- runsaga
