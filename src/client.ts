import { Connection, Client } from '@temporalio/client';
import { nanoid } from 'nanoid';
import { TASK_QUEUE_NAME } from './shared';

// import your workflow
import { approveSignal, workflowStatusQuery, WorkshopWorkflow } from './workflows';

async function run() {
  // Connect to the default Server location
  const connection = await Connection.connect({ address: 'localhost:7233' });
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  const handle = await client.workflow.start(WorkshopWorkflow, {
    taskQueue: TASK_QUEUE_NAME,
    // type inference works! args: [name: string]
    args: ['Temporal'],
    // in practice, use a meaningful business ID, like customerId or transactionId
    workflowId: 'workflow-' + nanoid(),
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // query this workflow
  const queryResponse = await handle.query(workflowStatusQuery);

  console.log(`The response from the query is ${queryResponse}`);

  // approve this workflow
  await handle.signal(approveSignal, null);

  // optional: wait for client result
  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
