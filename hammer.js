// const path = require('path');
// const config = {
//   uri: 'http://localhost',
//   port: 5003
// };
//
// module.exports = hammer => {
//
//   ////////////////////
//   // REGISTER TASKS //
//   ////////////////////
//
//   // Check if data file exists (if doesn't, suspend the task)
//   hammer.task('delete-data-file:before', (jobName, suspend) => {
//
//     return new Promise((resolve, reject) => {
//
//       // Get Chisel downloads registry
//       hammer.request({
//         uri: config.uri + '/downloads/registry',
//         port: config.port,
//         method: 'get'
//       })
//       .then(response => {
//
//         // Suspend the current job if Chisel responded with error
//         if ( response.statusCode !== 200 ) throw new Error(`Chisel responded with error ${response.body.message}`);
//
//         // Suspend the task if file doesn't exist
//         if ( ! response.body.includes('tmdata.gz') ) return suspend();
//
//         resolve();
//
//       })
//       .catch(error => {
//
//         // Suspend the job if there was an error with Chisel
//         hammer.suspend(jobName);
//         reject(error);
//
//       });
//
//     });
//
//   });
//
//   // Delete the data file before running the scraper
//   hammer.task('delete-data-file', jobName => {
//
//     return new Promise((resolve, reject) => {
//
//       // Delete the data file
//       hammer.request({
//         uri: config.uri + '/downloads/tmdata.gz',
//         port: config.port,
//         method: 'delete'
//       })
//       .then(response => {
//
//         // Suspend the current job if Chisel responded with error
//         if ( response.statusCode !== 200 ) throw new Error(`Chisel responded with error ${response.body.message}`);
//
//         resolve();
//
//       })
//       .catch(error => {
//
//         hammer.suspend(jobName);
//         reject(error);
//
//       });
//
//     });
//
//   });
//
//   // Upload the scraper if it doesn't exist
//   hammer.task('run-scraper:before', jobName => {
//
//     return new Promise((resolve, reject) => {
//
//       // Check if the scraper exists
//       hammer.request({
//         uri: config.uri + '/scraper/registry',
//         port: config.port,
//         method: 'get'
//       })
//       .then(response => {
//
//         // Suspend the current job if Chisel responded with error
//         if ( response.statusCode !== 200 ) throw new Error(`Chisel responded with error ${response.body.message}`);
//
//         // Upload the scraper if it doesn't exist
//         if ( ! response.body.includes('ticketmaster') ) return hammer.request({
//           uri: config.uri + '/scraper/new',
//           port: config.port,
//           method: 'post',
//           headers: {
//             'content-type': 'text/plain',
//             'content-disposition': 'ticketmaster'
//           },
//           body: require(path.join(__dirname, 'scrapers', 'ticketmaster.scraper.ts'))
//         });
//
//       })
//       .then(response => {
//
//         if ( ! response ) return resolve();
//
//         // Suspend the current job if Chisel responded with error
//         if ( response.statusCode !== 200 ) throw new Error(`Chisel responded with error ${response.body.message}`);
//
//         resolve();
//
//       })
//       .catch(error => {
//
//         hammer.suspend(jobName);
//         reject(error);
//
//       });
//
//     });
//
//   });
//
//   // Run the scraper
//   hammer.task('run-scraper', jobName => {
//
//
//
//   });
//
// };
//
// ///////////////////
// // REGISTER JOBS //
// ///////////////////
//
// hammer.job('scrape-ticketmaster', ['delete-data-file', 'run-scraper']);

module.exports = hammer => {

  hammer.task('task1:before', (jobName, suspend) => {

    hammer.log('task1:before suspending task1...');
    suspend();

  });

  hammer.task('task1:suspend', (jobName) => {

    hammer.log('task1:suspend on job ' + jobName);
    throw new Error('This error was thrown from task1:suspend!');

  });

  hammer.task('task1:error', (jobName, error) => {

    hammer.log('Error caught: ' + error);
    throw new Error('This error was thrown from task1:error!');

  });

  hammer.task('task1', () => {

    hammer.log('TASK 1');

  });

  hammer.task('task2', () => {

    hammer.log('TASK 2');

  });

  hammer.job('test', ['task1', 'task2']);

};
