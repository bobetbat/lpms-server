import type { TypedDataDomain } from '@ethersproject/abstract-signer';
import { VidereConfig } from '@windingtree/videre-sdk';
import dotenv from 'dotenv';
import { providers, utils } from 'ethers';
import {
  LineRegistry__factory,
  ServiceProviderRegistry__factory,
  ServiceProviderRegistry
} from '../typechain-videre';
import log from './services/LogService';

dotenv.config();

const checkEnvVariables = (vars: string[]): void =>
  vars.forEach((variable) => {
    if (!process.env[variable] || process.env[variable] === '') {
      throw new Error(`${variable} must be provided in the ENV`);
    }
  });

checkEnvVariables([
  'PORT',
  'APP_ACCESS_TOKEN_KEY',
  'APP_REFRESH_TOKEN_KEY',
  'APP_WALLET_PASSPHRASE',
  'WEB3STORAGE_KEY',
  'APP_PROMETHEUS_PORT',
  'APP_NETWORK_PROVIDER',
  'APP_VERIFYING_CONTRACT',
  'APP_LINE',
  'APP_VERSION'
]);

export const port = Number(process.env.PORT);
export const accessTokenKey = String(process.env.APP_ACCESS_TOKEN_KEY);
export const refreshTokenKey = String(process.env.APP_REFRESH_TOKEN_KEY);
export const walletPassphrase = String(process.env.APP_WALLET_PASSPHRASE);
export const debugEnabled = Boolean(process.env.DEBUG_LPMS_SERVER === 'true');
export const prometheusEnabled = Boolean(
  process.env.PROMETHEUS_ENABLED === 'true'
);
export const prometheusPort = Number(process.env.APP_PROMETHEUS_PORT);
export const refreshTokenMaxAge = 30 * 24 * 60 * 60 * 1000; //30d
export const accessTokenMaxAge = 30 * 60 * 1000; //30m
export const defaultManagerLogin = 'manager';
export const defaultManagerPassword = 'winwin';
export const web3StorageKey = process.env.WEB3STORAGE_KEY as string;
export const defaultActivateFacilities = Boolean(
  process.env.APP_DEFAULT_ACTIVATE_FACILITIES === 'true'
);

export const wakuConfig = {
  bootstrap: {
    maxPeers: 6,
    peers: [
      '/dns4/node-01.us-east-1.waku.windingtree.com/tcp/443/wss/p2p/16Uiu2HAmHXSN2XDZXdy8Dvyty5LtT7iSnWLGLMPoYbBnHaKeURxb',
      '/dns4/node-01.eu-central-1.waku.windingtree.com/tcp/443/wss/p2p/16Uiu2HAmV2PXCqrrjHbkceguC4Y2q7XgmzzYfjEgd69RvAU3wKvU',
      '/dns4/node-01.ap-southeast-2.waku.windingtree.com/tcp/443/wss/p2p/16Uiu2HAmGdTv8abaCW2BHYUhGeH97x7epzzbRY1CsgPbKhiJUB6C'
    ]
  }
};
export const videreConfig: VidereConfig = {
  line: String(process.env.APP_LINE),
  version: Number(process.env.APP_VERSION)
};

export let lineRegistryDataDomain: TypedDataDomain;
export let serviceProviderDataDomain: TypedDataDomain;
export let staysDataDomain: TypedDataDomain;

export const provider = new providers.JsonRpcProvider(
  String(process.env.APP_NETWORK_PROVIDER)
);
export const lineRegistry = String(process.env.APP_VERIFYING_CONTRACT);
export const lineRegistryContract = LineRegistry__factory.connect(
  lineRegistry,
  provider
);

export let serviceProviderRegistryAddress: string;
export let lineRegistryAddress: string;
export let staysAddress: string;

export const getServiceProviderContract = (): ServiceProviderRegistry => {
  if (!serviceProviderRegistryAddress) {
    throw new Error(
      'Address of the ServiceProviderRegistry not initialized yet'
    );
  }
  return ServiceProviderRegistry__factory.connect(
    serviceProviderRegistryAddress,
    provider
  );
};

// configure from the RPC
(async () => {
  const chainId = (await provider.getNetwork()).chainId;

  serviceProviderRegistryAddress =
    await lineRegistryContract.serviceProviderRegistry();
  staysAddress = await lineRegistryContract.terms(
    utils.formatBytes32String(videreConfig.line)
  );

  log.green(`Chain ID: ${chainId}`);
  log.green(`Line registry: ${lineRegistry}`);
  log.green(`Service Provider registry: ${serviceProviderRegistryAddress}`);
  log.green(`Stays: ${staysAddress}`);

  // line registry
  lineRegistryDataDomain = {
    name: videreConfig.line,
    version: String(videreConfig.version),
    verifyingContract: lineRegistry,
    chainId: Number(chainId)
  };

  // service provider registry
  serviceProviderDataDomain = {
    name: videreConfig.line,
    version: String(videreConfig.version),
    verifyingContract: serviceProviderRegistryAddress,
    chainId: Number(chainId)
  };

  // stays contract
  staysDataDomain = {
    name: videreConfig.line,
    version: String(videreConfig.version),
    verifyingContract: staysAddress,
    chainId: Number(chainId)
  };
})();
