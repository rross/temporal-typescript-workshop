import { log, sleep } from '@temporalio/activity';

export const createActivities = () => ({
    async echo(input: string): Promise<string> {
        log.info('echo activity started', { input });
    
        await sleep(1000);
    
        return input;
    }
})
