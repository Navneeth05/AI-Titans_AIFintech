import { D as Component, O as ErrorFactory, c as _getProvider, f as _registerComponent, k as FirebaseError, w as openDB, x as registerVersion } from "./index.esm-C1i3BtqY.js";
//#region node_modules/@firebase/installations/dist/esm/index.esm.js
var name = "@firebase/installations";
var version = "0.6.21";
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var PENDING_TIMEOUT_MS = 1e4;
var PACKAGE_VERSION = `w:${version}`;
var INTERNAL_AUTH_VERSION = "FIS_v2";
var INSTALLATIONS_API_URL = "https://firebaseinstallations.googleapis.com/v1";
var TOKEN_EXPIRATION_BUFFER = 3600 * 1e3;
var ERROR_FACTORY = new ErrorFactory("installations", "Installations", {
	["missing-app-config-values"]: "Missing App configuration value: \"{$valueName}\"",
	["not-registered"]: "Firebase Installation is not registered.",
	["installation-not-found"]: "Firebase Installation not found.",
	["request-failed"]: "{$requestName} request failed with error \"{$serverCode} {$serverStatus}: {$serverMessage}\"",
	["app-offline"]: "Could not process request. Application offline.",
	["delete-pending-registration"]: "Can't delete installation while there is a pending registration request."
});
/** Returns true if error is a FirebaseError that is based on an error from the server. */
function isServerError(error) {
	return error instanceof FirebaseError && error.code.includes("request-failed");
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function getInstallationsEndpoint({ projectId }) {
	return `${INSTALLATIONS_API_URL}/projects/${projectId}/installations`;
}
function extractAuthTokenInfoFromResponse(response) {
	return {
		token: response.token,
		requestStatus: 2,
		expiresIn: getExpiresInFromResponseExpiresIn(response.expiresIn),
		creationTime: Date.now()
	};
}
async function getErrorFromResponse(requestName, response) {
	const errorData = (await response.json()).error;
	return ERROR_FACTORY.create("request-failed", {
		requestName,
		serverCode: errorData.code,
		serverMessage: errorData.message,
		serverStatus: errorData.status
	});
}
function getHeaders({ apiKey }) {
	return new Headers({
		"Content-Type": "application/json",
		Accept: "application/json",
		"x-goog-api-key": apiKey
	});
}
function getHeadersWithAuth(appConfig, { refreshToken }) {
	const headers = getHeaders(appConfig);
	headers.append("Authorization", getAuthorizationHeader(refreshToken));
	return headers;
}
/**
* Calls the passed in fetch wrapper and returns the response.
* If the returned response has a status of 5xx, re-runs the function once and
* returns the response.
*/
async function retryIfServerError(fn) {
	const result = await fn();
	if (result.status >= 500 && result.status < 600) return fn();
	return result;
}
function getExpiresInFromResponseExpiresIn(responseExpiresIn) {
	return Number(responseExpiresIn.replace("s", "000"));
}
function getAuthorizationHeader(refreshToken) {
	return `${INTERNAL_AUTH_VERSION} ${refreshToken}`;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function createInstallationRequest({ appConfig, heartbeatServiceProvider }, { fid }) {
	const endpoint = getInstallationsEndpoint(appConfig);
	const headers = getHeaders(appConfig);
	const heartbeatService = heartbeatServiceProvider.getImmediate({ optional: true });
	if (heartbeatService) {
		const heartbeatsHeader = await heartbeatService.getHeartbeatsHeader();
		if (heartbeatsHeader) headers.append("x-firebase-client", heartbeatsHeader);
	}
	const body = {
		fid,
		authVersion: INTERNAL_AUTH_VERSION,
		appId: appConfig.appId,
		sdkVersion: PACKAGE_VERSION
	};
	const request = {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	};
	const response = await retryIfServerError(() => fetch(endpoint, request));
	if (response.ok) {
		const responseValue = await response.json();
		return {
			fid: responseValue.fid || fid,
			registrationStatus: 2,
			refreshToken: responseValue.refreshToken,
			authToken: extractAuthTokenInfoFromResponse(responseValue.authToken)
		};
	} else throw await getErrorFromResponse("Create Installation", response);
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/** Returns a promise that resolves after given time passes. */
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function bufferToBase64UrlSafe(array) {
	return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_");
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var VALID_FID_PATTERN = /^[cdef][\w-]{21}$/;
var INVALID_FID = "";
/**
* Generates a new FID using random values from Web Crypto API.
* Returns an empty string if FID generation fails for any reason.
*/
function generateFid() {
	try {
		const fidByteArray = new Uint8Array(17);
		(self.crypto || self.msCrypto).getRandomValues(fidByteArray);
		fidByteArray[0] = 112 + fidByteArray[0] % 16;
		const fid = encode(fidByteArray);
		return VALID_FID_PATTERN.test(fid) ? fid : INVALID_FID;
	} catch {
		return INVALID_FID;
	}
}
/** Converts a FID Uint8Array to a base64 string representation. */
function encode(fidByteArray) {
	return bufferToBase64UrlSafe(fidByteArray).substr(0, 22);
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/** Returns a string key that can be used to identify the app. */
function getKey(appConfig) {
	return `${appConfig.appName}!${appConfig.appId}`;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var fidChangeCallbacks = /* @__PURE__ */ new Map();
/**
* Calls the onIdChange callbacks with the new FID value, and broadcasts the
* change to other tabs.
*/
function fidChanged(appConfig, fid) {
	const key = getKey(appConfig);
	callFidChangeCallbacks(key, fid);
	broadcastFidChange(key, fid);
}
function callFidChangeCallbacks(key, fid) {
	const callbacks = fidChangeCallbacks.get(key);
	if (!callbacks) return;
	for (const callback of callbacks) callback(fid);
}
function broadcastFidChange(key, fid) {
	const channel = getBroadcastChannel();
	if (channel) channel.postMessage({
		key,
		fid
	});
	closeBroadcastChannel();
}
var broadcastChannel = null;
/** Opens and returns a BroadcastChannel if it is supported by the browser. */
function getBroadcastChannel() {
	if (!broadcastChannel && "BroadcastChannel" in self) {
		broadcastChannel = new BroadcastChannel("[Firebase] FID Change");
		broadcastChannel.onmessage = (e) => {
			callFidChangeCallbacks(e.data.key, e.data.fid);
		};
	}
	return broadcastChannel;
}
function closeBroadcastChannel() {
	if (fidChangeCallbacks.size === 0 && broadcastChannel) {
		broadcastChannel.close();
		broadcastChannel = null;
	}
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var DATABASE_NAME = "firebase-installations-database";
var DATABASE_VERSION = 1;
var OBJECT_STORE_NAME = "firebase-installations-store";
var dbPromise = null;
function getDbPromise() {
	if (!dbPromise) dbPromise = openDB(DATABASE_NAME, DATABASE_VERSION, { upgrade: (db, oldVersion) => {
		switch (oldVersion) {
			case 0: db.createObjectStore(OBJECT_STORE_NAME);
		}
	} });
	return dbPromise;
}
/** Assigns or overwrites the record for the given key with the given value. */
async function set(appConfig, value) {
	const key = getKey(appConfig);
	const tx = (await getDbPromise()).transaction(OBJECT_STORE_NAME, "readwrite");
	const objectStore = tx.objectStore(OBJECT_STORE_NAME);
	const oldValue = await objectStore.get(key);
	await objectStore.put(value, key);
	await tx.done;
	if (!oldValue || oldValue.fid !== value.fid) fidChanged(appConfig, value.fid);
	return value;
}
/** Removes record(s) from the objectStore that match the given key. */
async function remove(appConfig) {
	const key = getKey(appConfig);
	const tx = (await getDbPromise()).transaction(OBJECT_STORE_NAME, "readwrite");
	await tx.objectStore(OBJECT_STORE_NAME).delete(key);
	await tx.done;
}
/**
* Atomically updates a record with the result of updateFn, which gets
* called with the current value. If newValue is undefined, the record is
* deleted instead.
* @return Updated value
*/
async function update(appConfig, updateFn) {
	const key = getKey(appConfig);
	const tx = (await getDbPromise()).transaction(OBJECT_STORE_NAME, "readwrite");
	const store = tx.objectStore(OBJECT_STORE_NAME);
	const oldValue = await store.get(key);
	const newValue = updateFn(oldValue);
	if (newValue === void 0) await store.delete(key);
	else await store.put(newValue, key);
	await tx.done;
	if (newValue && (!oldValue || oldValue.fid !== newValue.fid)) fidChanged(appConfig, newValue.fid);
	return newValue;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Updates and returns the InstallationEntry from the database.
* Also triggers a registration request if it is necessary and possible.
*/
async function getInstallationEntry(installations) {
	let registrationPromise;
	const installationEntry = await update(installations.appConfig, (oldEntry) => {
		const entryWithPromise = triggerRegistrationIfNecessary(installations, updateOrCreateInstallationEntry(oldEntry));
		registrationPromise = entryWithPromise.registrationPromise;
		return entryWithPromise.installationEntry;
	});
	if (installationEntry.fid === INVALID_FID) return { installationEntry: await registrationPromise };
	return {
		installationEntry,
		registrationPromise
	};
}
/**
* Creates a new Installation Entry if one does not exist.
* Also clears timed out pending requests.
*/
function updateOrCreateInstallationEntry(oldEntry) {
	return clearTimedOutRequest(oldEntry || {
		fid: generateFid(),
		registrationStatus: 0
	});
}
/**
* If the Firebase Installation is not registered yet, this will trigger the
* registration and return an InProgressInstallationEntry.
*
* If registrationPromise does not exist, the installationEntry is guaranteed
* to be registered.
*/
function triggerRegistrationIfNecessary(installations, installationEntry) {
	if (installationEntry.registrationStatus === 0) {
		if (!navigator.onLine) return {
			installationEntry,
			registrationPromise: Promise.reject(ERROR_FACTORY.create("app-offline"))
		};
		const inProgressEntry = {
			fid: installationEntry.fid,
			registrationStatus: 1,
			registrationTime: Date.now()
		};
		return {
			installationEntry: inProgressEntry,
			registrationPromise: registerInstallation(installations, inProgressEntry)
		};
	} else if (installationEntry.registrationStatus === 1) return {
		installationEntry,
		registrationPromise: waitUntilFidRegistration(installations)
	};
	else return { installationEntry };
}
/** This will be executed only once for each new Firebase Installation. */
async function registerInstallation(installations, installationEntry) {
	try {
		const registeredInstallationEntry = await createInstallationRequest(installations, installationEntry);
		return set(installations.appConfig, registeredInstallationEntry);
	} catch (e) {
		if (isServerError(e) && e.customData.serverCode === 409) await remove(installations.appConfig);
		else await set(installations.appConfig, {
			fid: installationEntry.fid,
			registrationStatus: 0
		});
		throw e;
	}
}
/** Call if FID registration is pending in another request. */
async function waitUntilFidRegistration(installations) {
	let entry = await updateInstallationRequest(installations.appConfig);
	while (entry.registrationStatus === 1) {
		await sleep(100);
		entry = await updateInstallationRequest(installations.appConfig);
	}
	if (entry.registrationStatus === 0) {
		const { installationEntry, registrationPromise } = await getInstallationEntry(installations);
		if (registrationPromise) return registrationPromise;
		else return installationEntry;
	}
	return entry;
}
/**
* Called only if there is a CreateInstallation request in progress.
*
* Updates the InstallationEntry in the DB based on the status of the
* CreateInstallation request.
*
* Returns the updated InstallationEntry.
*/
function updateInstallationRequest(appConfig) {
	return update(appConfig, (oldEntry) => {
		if (!oldEntry) throw ERROR_FACTORY.create("installation-not-found");
		return clearTimedOutRequest(oldEntry);
	});
}
function clearTimedOutRequest(entry) {
	if (hasInstallationRequestTimedOut(entry)) return {
		fid: entry.fid,
		registrationStatus: 0
	};
	return entry;
}
function hasInstallationRequestTimedOut(installationEntry) {
	return installationEntry.registrationStatus === 1 && installationEntry.registrationTime + PENDING_TIMEOUT_MS < Date.now();
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function generateAuthTokenRequest({ appConfig, heartbeatServiceProvider }, installationEntry) {
	const endpoint = getGenerateAuthTokenEndpoint(appConfig, installationEntry);
	const headers = getHeadersWithAuth(appConfig, installationEntry);
	const heartbeatService = heartbeatServiceProvider.getImmediate({ optional: true });
	if (heartbeatService) {
		const heartbeatsHeader = await heartbeatService.getHeartbeatsHeader();
		if (heartbeatsHeader) headers.append("x-firebase-client", heartbeatsHeader);
	}
	const body = { installation: {
		sdkVersion: PACKAGE_VERSION,
		appId: appConfig.appId
	} };
	const request = {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	};
	const response = await retryIfServerError(() => fetch(endpoint, request));
	if (response.ok) return extractAuthTokenInfoFromResponse(await response.json());
	else throw await getErrorFromResponse("Generate Auth Token", response);
}
function getGenerateAuthTokenEndpoint(appConfig, { fid }) {
	return `${getInstallationsEndpoint(appConfig)}/${fid}/authTokens:generate`;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Returns a valid authentication token for the installation. Generates a new
* token if one doesn't exist, is expired or about to expire.
*
* Should only be called if the Firebase Installation is registered.
*/
async function refreshAuthToken(installations, forceRefresh = false) {
	let tokenPromise;
	const entry = await update(installations.appConfig, (oldEntry) => {
		if (!isEntryRegistered(oldEntry)) throw ERROR_FACTORY.create("not-registered");
		const oldAuthToken = oldEntry.authToken;
		if (!forceRefresh && isAuthTokenValid(oldAuthToken)) return oldEntry;
		else if (oldAuthToken.requestStatus === 1) {
			tokenPromise = waitUntilAuthTokenRequest(installations, forceRefresh);
			return oldEntry;
		} else {
			if (!navigator.onLine) throw ERROR_FACTORY.create("app-offline");
			const inProgressEntry = makeAuthTokenRequestInProgressEntry(oldEntry);
			tokenPromise = fetchAuthTokenFromServer(installations, inProgressEntry);
			return inProgressEntry;
		}
	});
	return tokenPromise ? await tokenPromise : entry.authToken;
}
/**
* Call only if FID is registered and Auth Token request is in progress.
*
* Waits until the current pending request finishes. If the request times out,
* tries once in this thread as well.
*/
async function waitUntilAuthTokenRequest(installations, forceRefresh) {
	let entry = await updateAuthTokenRequest(installations.appConfig);
	while (entry.authToken.requestStatus === 1) {
		await sleep(100);
		entry = await updateAuthTokenRequest(installations.appConfig);
	}
	const authToken = entry.authToken;
	if (authToken.requestStatus === 0) return refreshAuthToken(installations, forceRefresh);
	else return authToken;
}
/**
* Called only if there is a GenerateAuthToken request in progress.
*
* Updates the InstallationEntry in the DB based on the status of the
* GenerateAuthToken request.
*
* Returns the updated InstallationEntry.
*/
function updateAuthTokenRequest(appConfig) {
	return update(appConfig, (oldEntry) => {
		if (!isEntryRegistered(oldEntry)) throw ERROR_FACTORY.create("not-registered");
		const oldAuthToken = oldEntry.authToken;
		if (hasAuthTokenRequestTimedOut(oldAuthToken)) return {
			...oldEntry,
			authToken: { requestStatus: 0 }
		};
		return oldEntry;
	});
}
async function fetchAuthTokenFromServer(installations, installationEntry) {
	try {
		const authToken = await generateAuthTokenRequest(installations, installationEntry);
		const updatedInstallationEntry = {
			...installationEntry,
			authToken
		};
		await set(installations.appConfig, updatedInstallationEntry);
		return authToken;
	} catch (e) {
		if (isServerError(e) && (e.customData.serverCode === 401 || e.customData.serverCode === 404)) await remove(installations.appConfig);
		else {
			const updatedInstallationEntry = {
				...installationEntry,
				authToken: { requestStatus: 0 }
			};
			await set(installations.appConfig, updatedInstallationEntry);
		}
		throw e;
	}
}
function isEntryRegistered(installationEntry) {
	return installationEntry !== void 0 && installationEntry.registrationStatus === 2;
}
function isAuthTokenValid(authToken) {
	return authToken.requestStatus === 2 && !isAuthTokenExpired(authToken);
}
function isAuthTokenExpired(authToken) {
	const now = Date.now();
	return now < authToken.creationTime || authToken.creationTime + authToken.expiresIn < now + TOKEN_EXPIRATION_BUFFER;
}
/** Returns an updated InstallationEntry with an InProgressAuthToken. */
function makeAuthTokenRequestInProgressEntry(oldEntry) {
	const inProgressAuthToken = {
		requestStatus: 1,
		requestTime: Date.now()
	};
	return {
		...oldEntry,
		authToken: inProgressAuthToken
	};
}
function hasAuthTokenRequestTimedOut(authToken) {
	return authToken.requestStatus === 1 && authToken.requestTime + PENDING_TIMEOUT_MS < Date.now();
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Creates a Firebase Installation if there isn't one for the app and
* returns the Installation ID.
* @param installations - The `Installations` instance.
*
* @public
*/
async function getId(installations) {
	const installationsImpl = installations;
	const { installationEntry, registrationPromise } = await getInstallationEntry(installationsImpl);
	if (registrationPromise) registrationPromise.catch(console.error);
	else refreshAuthToken(installationsImpl).catch(console.error);
	return installationEntry.fid;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Returns a Firebase Installations auth token, identifying the current
* Firebase Installation.
* @param installations - The `Installations` instance.
* @param forceRefresh - Force refresh regardless of token expiration.
*
* @public
*/
async function getToken(installations, forceRefresh = false) {
	const installationsImpl = installations;
	await completeInstallationRegistration(installationsImpl);
	return (await refreshAuthToken(installationsImpl, forceRefresh)).token;
}
async function completeInstallationRegistration(installations) {
	const { registrationPromise } = await getInstallationEntry(installations);
	if (registrationPromise) await registrationPromise;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function extractAppConfig(app) {
	if (!app || !app.options) throw getMissingValueError("App Configuration");
	if (!app.name) throw getMissingValueError("App Name");
	for (const keyName of [
		"projectId",
		"apiKey",
		"appId"
	]) if (!app.options[keyName]) throw getMissingValueError(keyName);
	return {
		appName: app.name,
		projectId: app.options.projectId,
		apiKey: app.options.apiKey,
		appId: app.options.appId
	};
}
function getMissingValueError(valueName) {
	return ERROR_FACTORY.create("missing-app-config-values", { valueName });
}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var INSTALLATIONS_NAME = "installations";
var INSTALLATIONS_NAME_INTERNAL = "installations-internal";
var publicFactory = (container) => {
	const app = container.getProvider("app").getImmediate();
	return {
		app,
		appConfig: extractAppConfig(app),
		heartbeatServiceProvider: _getProvider(app, "heartbeat"),
		_delete: () => Promise.resolve()
	};
};
var internalFactory = (container) => {
	const installations = _getProvider(container.getProvider("app").getImmediate(), INSTALLATIONS_NAME).getImmediate();
	return {
		getId: () => getId(installations),
		getToken: (forceRefresh) => getToken(installations, forceRefresh)
	};
};
function registerInstallations() {
	_registerComponent(new Component(INSTALLATIONS_NAME, publicFactory, "PUBLIC"));
	_registerComponent(new Component(INSTALLATIONS_NAME_INTERNAL, internalFactory, "PRIVATE"));
}
/**
* The Firebase Installations Web SDK.
* This SDK does not work in a Node.js environment.
*
* @packageDocumentation
*/
registerInstallations();
registerVersion(name, version);
registerVersion(name, version, "esm2020");
//#endregion

//# sourceMappingURL=index.esm-CnlNjAwX.js.map