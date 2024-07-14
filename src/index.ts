#!/usr/bin/env node

import * as run from '@google-cloud/run';
import * as ini from 'ini';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

async function cleanupService(
  client: run.RevisionsClient,
  project: string,
  region: string,
  service: run.protos.google.cloud.run.v2.IService
) {
  const activeImages = new Set<string>();
  for await (const revision of client.listRevisionsAsync({
    parent: service.name!,
  })) {
    console.log('Revision:', revision.name);
    let active = false;
    for (const condition of revision.conditions ?? []) {
      if (condition.type === 'Active') {
        active = condition.state === 'CONDITION_SUCCEEDED';
        break;
      }
    }
    if (active) {
      for (const container of revision.containers ?? []) {
        if (container.image) {
          activeImages.add(container.image);
        }
      }
      console.log('  - active revision, skipping');
      continue;
    }
    console.log('  - deleting revision:');
    await client.deleteRevision({
      name: revision.name!,
    });
  }

  const serviceName = client.matchServiceFromServiceName(service.name!);
  console.log('service name:', serviceName);
  const listImagesCmdline = [
    'gcloud artifacts docker images list',
    `${region}-docker.pkg.dev/${project}/cloud-run-source-deploy/${serviceName}`,
    '--include-tags',
    '--format=json',
  ];
  const {stdout} = await exec(listImagesCmdline.join(' '));
  const images = JSON.parse(stdout) as Array<{
    package: string;
    version: string;
    tags: string[];
  }>;
  for (const image of images) {
    const {package: packageName, version, tags: tags} = image;
    const imageName = `${packageName}@${version}`;
    if (activeImages.has(imageName) || tags.includes('latest')) {
      console.log(`Skipping active image: ${imageName}`);
      continue;
    }
    console.log(`Deleting image: ${imageName}`);
    const deleteImageCmdline = [
      'gcloud artifacts docker images delete',
      imageName,
      '--delete-tags',
      '--quiet',
    ];
    await exec(deleteImageCmdline.join(' '));
  }
}

async function main() {
  const gcloudConfigFile = path.join(
    process.env['HOME'] ?? '.',
    '.config',
    'gcloud',
    'configurations',
    'config_default'
  );
  if (!fs.existsSync(gcloudConfigFile)) {
    throw new Error(`gcloud config file not found at ${gcloudConfigFile}`);
  }

  const gcloudConfigContent = (await fsp.readFile(gcloudConfigFile)).toString();
  const gcloudConfig = ini.parse(gcloudConfigContent);
  const region = gcloudConfig['run']['region'];
  if (!region) {
    throw new Error(
      `region not found in gcloud config file at ${gcloudConfigFile}: under [run], set e.g. region = us-central1`
    );
  }
  const project = gcloudConfig['core']['project'];
  if (!project) {
    throw new Error(
      `project not found in gcloud config file at ${gcloudConfigFile}: under [core], set e.g. project = my-project`
    );
  }

  const servicesClient = new run.ServicesClient();
  const revisionsClient = new run.RevisionsClient();
  for await (const service of servicesClient.listServicesAsync({
    parent: `projects/${project}/locations/${region}`,
  })) {
    await cleanupService(revisionsClient, project, region, service);
  }
}

main();
