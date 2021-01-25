const path = require('path');
const { promisify } = require('util');
const chalk = require('chalk');
const rimraf = require('rimraf');
const onExit = require('signal-exit');
const execa = require('execa');
const { build: esBuild } = require('esbuild');
const { build: spBuild, startServer } = require('snowpack');

const config = require('../config');
const getESBuildConfig = require('./get-esbuild-config');
const getSnowpackConfig = require('./get-snowpack-config');

exports.clean = async () => {
  try {
    await promisify(rimraf)(config.outputDir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

exports.dev = async () => {
  let electron;
  let snowpack;
  let esbuild;

  onExit(async (code) => {
    console.log(
      code === 1
        ? chalk.red('🚨 An unexpected error has occurred!')
        : chalk.yellow('🔌 Shutting down gracefully...')
    );
    try {
      if (electron && !electron.killed) electron.kill();
      if (snowpack) await snowpack.shutdown();
      if (esbuild) esbuild.rebuild.dispose();
    } finally {
      process.exit(code);
    }
  });

  const startSnowpack = async () => {
    const spConfig = await getSnowpackConfig();
    snowpack = await startServer({ config: spConfig });
  };

  const startESBuild = async () => {
    esbuild = await esBuild(await getESBuildConfig({ incremental: true }));

    // TODO:
    // https://esbuild.github.io/api/#incremental
    // let result2 = await result.rebuild()
  };

  const startElectron = async () => {
    electron = execa('electron', [path.join(config.outputDir, 'main/index.js')]);
    electron.stdout.pipe(process.stdout);
    electron.stderr.pipe(process.stderr);
    electron.on('close', () => process.exit(0));
    electron.on('error', () => process.exit(1));
    await electron;
  };

  try {
    await Promise.all([startSnowpack(), startESBuild()]);
    await startElectron();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

exports.build = async () => {
  try {
    await Promise.all([
      esBuild(await getESBuildConfig()),
      spBuild({ config: await getSnowpackConfig() }),
    ]);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
