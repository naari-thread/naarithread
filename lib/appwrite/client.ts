"use client";

import { Account, Client, Databases } from "appwrite";
import { appwritePublicConfig } from "@/lib/appwrite/constants";

let browserClient: Client | null = null;
let browserAccount: Account | null = null;
let browserDatabases: Databases | null = null;

function getOrCreateBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  if (!appwritePublicConfig.projectId) {
    return null;
  }

  browserClient = new Client()
    .setEndpoint(appwritePublicConfig.endpoint)
    .setProject(appwritePublicConfig.projectId);

  return browserClient;
}

export function getBrowserAccount() {
  if (browserAccount) {
    return browserAccount;
  }

  const client = getOrCreateBrowserClient();
  if (!client) {
    return null;
  }

  browserAccount = new Account(client);
  return browserAccount;
}

export function getBrowserDatabases() {
  if (browserDatabases) {
    return browserDatabases;
  }

  const client = getOrCreateBrowserClient();
  if (!client) {
    return null;
  }

  browserDatabases = new Databases(client);
  return browserDatabases;
}
