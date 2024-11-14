import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { proxyActivities, log, sleep } from '@temporalio/workflow';

import { after, before, it } from 'mocha';
import assert from 'assert';

import { approveSignal, WorkshopWorkflow } from '../workflows';
import { createActivities } from '../activities';

const testingTaskQueue = 'WorkshopTestTaskQueue';

describe('Testing Happy Path', () => {
    let testEnv: TestWorkflowEnvironment;

    before(async () => {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();  
        // testEnv = await TestWorkflowEnvironment.createLocal();      
      });

      after(async () => {
        await testEnv?.teardown();
      });

      it('successfully completes the Workflow', async () => {
        const { client, nativeConnection } = testEnv;
    
        const worker = await Worker.create({
          connection: nativeConnection,
          taskQueue: testingTaskQueue,
          workflowsPath: require.resolve('../workflows'),
          activities: createActivities(),
        });

        const handle = await client.workflow.start(WorkshopWorkflow, {
          taskQueue: testingTaskQueue,
          args: ['Testing'],
          workflowId: 'test',
        });

        // signal the workflow
        handle.signal(approveSignal, null);

        const result = await worker.runUntil(
          handle.result()
        );

        assert.equal(result, 'Echo returned: Testing');
      });
});

describe('Testing Workflow Not Approved', () => {
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
      testEnv = await TestWorkflowEnvironment.createTimeSkipping();  
      // testEnv = await TestWorkflowEnvironment.createLocal();      
    });

    after(async () => {
      await testEnv?.teardown();
    });

    it('successfully completes the Workflow', async () => {
      const { client, nativeConnection } = testEnv;
  
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: testingTaskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities: createActivities(),
      });

      const handle = await client.workflow.start(WorkshopWorkflow, {
        taskQueue: testingTaskQueue,
        args: ['Testing'],
        workflowId: 'test',
      });

      try {
        const result = await worker.runUntil(
          handle.result()
        );
        assert.fail('Expecting an exception. Does the workflow throw an Error?')
      } 
      catch(e) {
        // expected
        console.log(`Exception caught. ${e}`);
      }
      
    });
});