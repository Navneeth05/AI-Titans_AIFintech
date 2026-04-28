import { A as areCookiesEnabled, C as deleteDB, D as Component, J as isIndexedDBAvailable, O as ErrorFactory, V as getModularInstance, c as _getProvider, f as _registerComponent, g as getApp, nt as validateIndexedDBOpenable, w as openDB, x as registerVersion } from "./index.esm-C1i3BtqY.js";
import "./index.esm-CnlNjAwX.js";
//#region node_modules/@firebase/messaging/dist/esm/index.esm.js
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
var DEFAULT_SW_PATH = "/firebase-messaging-sw.js";
var DEFAULT_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
var DEFAULT_VAPID_KEY = "BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4";
var ENDPOINT = "https://fcmregistrations.googleapis.com/v1";
var CONSOLE_CAMPAIGN_ID = "google.c.a.c_id";
var CONSOLE_CAMPAIGN_NAME = "google.c.a.c_l";
var CONSOLE_CAMPAIGN_TIME = "google.c.a.ts";
/** Set to '1' if Analytics is enabled for the campaign */
var CONSOLE_CAMPAIGN_ANALYTICS_ENABLED = "google.c.a.e";
var DEFAULT_REGISTRATION_TIMEOUT = 1e4;
var MessageType$1;
(function(MessageType) {
	MessageType[MessageType["DATA_MESSAGE"] = 1] = "DATA_MESSAGE";
	MessageType[MessageType["DISPLAY_NOTIFICATION"] = 3] = "DISPLAY_NOTIFICATION";
})(MessageType$1 || (MessageType$1 = {}));
/**
* @license
* Copyright 2018 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
* in compliance with the License. You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software distributed under the License
* is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
* or implied. See the License for the specific language governing permissions and limitations under
* the License.
*/
var MessageType;
(function(MessageType) {
	MessageType["PUSH_RECEIVED"] = "push-received";
	MessageType["NOTIFICATION_CLICKED"] = "notification-clicked";
})(MessageType || (MessageType = {}));
/**
* @license
* Copyright 2017 Google LLC
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
function arrayToBase64(array) {
	const uint8Array = new Uint8Array(array);
	return btoa(String.fromCharCode(...uint8Array)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64ToArray(base64String) {
	const base64 = (base64String + "=".repeat((4 - base64String.length % 4) % 4)).replace(/\-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
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
var OLD_DB_NAME = "fcm_token_details_db";
/**
* The last DB version of 'fcm_token_details_db' was 4. This is one higher, so that the upgrade
* callback is called for all versions of the old DB.
*/
var OLD_DB_VERSION = 5;
var OLD_OBJECT_STORE_NAME = "fcm_token_object_Store";
async function migrateOldDatabase(senderId) {
	if ("databases" in indexedDB) {
		if (!(await indexedDB.databases()).map((db) => db.name).includes(OLD_DB_NAME)) return null;
	}
	let tokenDetails = null;
	(await openDB(OLD_DB_NAME, OLD_DB_VERSION, { upgrade: async (db, oldVersion, newVersion, upgradeTransaction) => {
		if (oldVersion < 2) return;
		if (!db.objectStoreNames.contains(OLD_OBJECT_STORE_NAME)) return;
		const objectStore = upgradeTransaction.objectStore(OLD_OBJECT_STORE_NAME);
		const value = await objectStore.index("fcmSenderId").get(senderId);
		await objectStore.clear();
		if (!value) return;
		if (oldVersion === 2) {
			const oldDetails = value;
			if (!oldDetails.auth || !oldDetails.p256dh || !oldDetails.endpoint) return;
			tokenDetails = {
				token: oldDetails.fcmToken,
				createTime: oldDetails.createTime ?? Date.now(),
				subscriptionOptions: {
					auth: oldDetails.auth,
					p256dh: oldDetails.p256dh,
					endpoint: oldDetails.endpoint,
					swScope: oldDetails.swScope,
					vapidKey: typeof oldDetails.vapidKey === "string" ? oldDetails.vapidKey : arrayToBase64(oldDetails.vapidKey)
				}
			};
		} else if (oldVersion === 3) {
			const oldDetails = value;
			tokenDetails = {
				token: oldDetails.fcmToken,
				createTime: oldDetails.createTime,
				subscriptionOptions: {
					auth: arrayToBase64(oldDetails.auth),
					p256dh: arrayToBase64(oldDetails.p256dh),
					endpoint: oldDetails.endpoint,
					swScope: oldDetails.swScope,
					vapidKey: arrayToBase64(oldDetails.vapidKey)
				}
			};
		} else if (oldVersion === 4) {
			const oldDetails = value;
			tokenDetails = {
				token: oldDetails.fcmToken,
				createTime: oldDetails.createTime,
				subscriptionOptions: {
					auth: arrayToBase64(oldDetails.auth),
					p256dh: arrayToBase64(oldDetails.p256dh),
					endpoint: oldDetails.endpoint,
					swScope: oldDetails.swScope,
					vapidKey: arrayToBase64(oldDetails.vapidKey)
				}
			};
		}
	} })).close();
	await deleteDB(OLD_DB_NAME);
	await deleteDB("fcm_vapid_details_db");
	await deleteDB("undefined");
	return checkTokenDetails(tokenDetails) ? tokenDetails : null;
}
function checkTokenDetails(tokenDetails) {
	if (!tokenDetails || !tokenDetails.subscriptionOptions) return false;
	const { subscriptionOptions } = tokenDetails;
	return typeof tokenDetails.createTime === "number" && tokenDetails.createTime > 0 && typeof tokenDetails.token === "string" && tokenDetails.token.length > 0 && typeof subscriptionOptions.auth === "string" && subscriptionOptions.auth.length > 0 && typeof subscriptionOptions.p256dh === "string" && subscriptionOptions.p256dh.length > 0 && typeof subscriptionOptions.endpoint === "string" && subscriptionOptions.endpoint.length > 0 && typeof subscriptionOptions.swScope === "string" && subscriptionOptions.swScope.length > 0 && typeof subscriptionOptions.vapidKey === "string" && subscriptionOptions.vapidKey.length > 0;
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
var DATABASE_NAME = "firebase-messaging-database";
var DATABASE_VERSION = 1;
var OBJECT_STORE_NAME = "firebase-messaging-store";
var dbPromise = null;
function getDbPromise() {
	if (!dbPromise) dbPromise = openDB(DATABASE_NAME, DATABASE_VERSION, { upgrade: (upgradeDb, oldVersion) => {
		switch (oldVersion) {
			case 0: upgradeDb.createObjectStore(OBJECT_STORE_NAME);
		}
	} });
	return dbPromise;
}
/** Gets record(s) from the objectStore that match the given key. */
async function dbGet(firebaseDependencies) {
	const key = getKey(firebaseDependencies);
	const tokenDetails = await (await getDbPromise()).transaction(OBJECT_STORE_NAME).objectStore(OBJECT_STORE_NAME).get(key);
	if (tokenDetails) return tokenDetails;
	else {
		const oldTokenDetails = await migrateOldDatabase(firebaseDependencies.appConfig.senderId);
		if (oldTokenDetails) {
			await dbSet(firebaseDependencies, oldTokenDetails);
			return oldTokenDetails;
		}
	}
}
/** Assigns or overwrites the record for the given key with the given value. */
async function dbSet(firebaseDependencies, tokenDetails) {
	const key = getKey(firebaseDependencies);
	const tx = (await getDbPromise()).transaction(OBJECT_STORE_NAME, "readwrite");
	await tx.objectStore(OBJECT_STORE_NAME).put(tokenDetails, key);
	await tx.done;
	return tokenDetails;
}
/** Removes record(s) from the objectStore that match the given key. */
async function dbRemove(firebaseDependencies) {
	const key = getKey(firebaseDependencies);
	const tx = (await getDbPromise()).transaction(OBJECT_STORE_NAME, "readwrite");
	await tx.objectStore(OBJECT_STORE_NAME).delete(key);
	await tx.done;
}
function getKey({ appConfig }) {
	return appConfig.appId;
}
var ERROR_FACTORY = new ErrorFactory("messaging", "Messaging", {
	["missing-app-config-values"]: "Missing App configuration value: \"{$valueName}\"",
	["only-available-in-window"]: "This method is available in a Window context.",
	["only-available-in-sw"]: "This method is available in a service worker context.",
	["permission-default"]: "The notification permission was not granted and dismissed instead.",
	["permission-blocked"]: "The notification permission was not granted and blocked instead.",
	["unsupported-browser"]: "This browser doesn't support the API's required to use the Firebase SDK.",
	["indexed-db-unsupported"]: "This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)",
	["failed-service-worker-registration"]: "We are unable to register the default service worker. {$browserErrorMessage}",
	["token-subscribe-failed"]: "A problem occurred while subscribing the user to FCM: {$errorInfo}",
	["token-subscribe-no-token"]: "FCM returned no token when subscribing the user to push.",
	["token-unsubscribe-failed"]: "A problem occurred while unsubscribing the user from FCM: {$errorInfo}",
	["token-update-failed"]: "A problem occurred while updating the user from FCM: {$errorInfo}",
	["token-update-no-token"]: "FCM returned no token when updating the user to push.",
	["use-sw-after-get-token"]: "The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.",
	["invalid-sw-registration"]: "The input to useServiceWorker() must be a ServiceWorkerRegistration.",
	["invalid-bg-handler"]: "The input to setBackgroundMessageHandler() must be a function.",
	["invalid-vapid-key"]: "The public VAPID key must be a string.",
	["use-vapid-key-after-get-token"]: "The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."
});
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
async function requestGetToken(firebaseDependencies, subscriptionOptions) {
	const headers = await getHeaders(firebaseDependencies);
	const body = getBody(subscriptionOptions);
	const subscribeOptions = {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	};
	let responseData;
	try {
		responseData = await (await fetch(getEndpoint(firebaseDependencies.appConfig), subscribeOptions)).json();
	} catch (err) {
		throw ERROR_FACTORY.create("token-subscribe-failed", { errorInfo: err?.toString() });
	}
	if (responseData.error) {
		const message = responseData.error.message;
		throw ERROR_FACTORY.create("token-subscribe-failed", { errorInfo: message });
	}
	if (!responseData.token) throw ERROR_FACTORY.create("token-subscribe-no-token");
	return responseData.token;
}
async function requestUpdateToken(firebaseDependencies, tokenDetails) {
	const headers = await getHeaders(firebaseDependencies);
	const body = getBody(tokenDetails.subscriptionOptions);
	const updateOptions = {
		method: "PATCH",
		headers,
		body: JSON.stringify(body)
	};
	let responseData;
	try {
		responseData = await (await fetch(`${getEndpoint(firebaseDependencies.appConfig)}/${tokenDetails.token}`, updateOptions)).json();
	} catch (err) {
		throw ERROR_FACTORY.create("token-update-failed", { errorInfo: err?.toString() });
	}
	if (responseData.error) {
		const message = responseData.error.message;
		throw ERROR_FACTORY.create("token-update-failed", { errorInfo: message });
	}
	if (!responseData.token) throw ERROR_FACTORY.create("token-update-no-token");
	return responseData.token;
}
async function requestDeleteToken(firebaseDependencies, token) {
	const unsubscribeOptions = {
		method: "DELETE",
		headers: await getHeaders(firebaseDependencies)
	};
	try {
		const responseData = await (await fetch(`${getEndpoint(firebaseDependencies.appConfig)}/${token}`, unsubscribeOptions)).json();
		if (responseData.error) {
			const message = responseData.error.message;
			throw ERROR_FACTORY.create("token-unsubscribe-failed", { errorInfo: message });
		}
	} catch (err) {
		throw ERROR_FACTORY.create("token-unsubscribe-failed", { errorInfo: err?.toString() });
	}
}
function getEndpoint({ projectId }) {
	return `${ENDPOINT}/projects/${projectId}/registrations`;
}
async function getHeaders({ appConfig, installations }) {
	const authToken = await installations.getToken();
	return new Headers({
		"Content-Type": "application/json",
		Accept: "application/json",
		"x-goog-api-key": appConfig.apiKey,
		"x-goog-firebase-installations-auth": `FIS ${authToken}`
	});
}
function getBody({ p256dh, auth, endpoint, vapidKey }) {
	const body = { web: {
		endpoint,
		auth,
		p256dh
	} };
	if (vapidKey !== DEFAULT_VAPID_KEY) body.web.applicationPubKey = vapidKey;
	return body;
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
var TOKEN_EXPIRATION_MS = 10080 * 60 * 1e3;
async function getTokenInternal(messaging) {
	const pushSubscription = await getPushSubscription(messaging.swRegistration, messaging.vapidKey);
	const subscriptionOptions = {
		vapidKey: messaging.vapidKey,
		swScope: messaging.swRegistration.scope,
		endpoint: pushSubscription.endpoint,
		auth: arrayToBase64(pushSubscription.getKey("auth")),
		p256dh: arrayToBase64(pushSubscription.getKey("p256dh"))
	};
	const tokenDetails = await dbGet(messaging.firebaseDependencies);
	if (!tokenDetails) return getNewToken(messaging.firebaseDependencies, subscriptionOptions);
	else if (!isTokenValid(tokenDetails.subscriptionOptions, subscriptionOptions)) {
		try {
			await requestDeleteToken(messaging.firebaseDependencies, tokenDetails.token);
		} catch (e) {
			console.warn(e);
		}
		return getNewToken(messaging.firebaseDependencies, subscriptionOptions);
	} else if (Date.now() >= tokenDetails.createTime + TOKEN_EXPIRATION_MS) return updateToken(messaging, {
		token: tokenDetails.token,
		createTime: Date.now(),
		subscriptionOptions
	});
	else return tokenDetails.token;
}
/**
* This method deletes the token from the database, unsubscribes the token from FCM, and unregisters
* the push subscription if it exists.
*/
async function deleteTokenInternal(messaging) {
	const tokenDetails = await dbGet(messaging.firebaseDependencies);
	if (tokenDetails) {
		await requestDeleteToken(messaging.firebaseDependencies, tokenDetails.token);
		await dbRemove(messaging.firebaseDependencies);
	}
	const pushSubscription = await messaging.swRegistration.pushManager.getSubscription();
	if (pushSubscription) return pushSubscription.unsubscribe();
	return true;
}
async function updateToken(messaging, tokenDetails) {
	try {
		const updatedToken = await requestUpdateToken(messaging.firebaseDependencies, tokenDetails);
		const updatedTokenDetails = {
			...tokenDetails,
			token: updatedToken,
			createTime: Date.now()
		};
		await dbSet(messaging.firebaseDependencies, updatedTokenDetails);
		return updatedToken;
	} catch (e) {
		throw e;
	}
}
async function getNewToken(firebaseDependencies, subscriptionOptions) {
	const tokenDetails = {
		token: await requestGetToken(firebaseDependencies, subscriptionOptions),
		createTime: Date.now(),
		subscriptionOptions
	};
	await dbSet(firebaseDependencies, tokenDetails);
	return tokenDetails.token;
}
/**
* Gets a PushSubscription for the current user.
*/
async function getPushSubscription(swRegistration, vapidKey) {
	const subscription = await swRegistration.pushManager.getSubscription();
	if (subscription) return subscription;
	return swRegistration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64ToArray(vapidKey)
	});
}
/**
* Checks if the saved tokenDetails object matches the configuration provided.
*/
function isTokenValid(dbOptions, currentOptions) {
	const isVapidKeyEqual = currentOptions.vapidKey === dbOptions.vapidKey;
	const isEndpointEqual = currentOptions.endpoint === dbOptions.endpoint;
	const isAuthEqual = currentOptions.auth === dbOptions.auth;
	const isP256dhEqual = currentOptions.p256dh === dbOptions.p256dh;
	return isVapidKeyEqual && isEndpointEqual && isAuthEqual && isP256dhEqual;
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
function externalizePayload(internalPayload) {
	const payload = {
		from: internalPayload.from,
		collapseKey: internalPayload.collapse_key,
		messageId: internalPayload.fcmMessageId
	};
	propagateNotificationPayload(payload, internalPayload);
	propagateDataPayload(payload, internalPayload);
	propagateFcmOptions(payload, internalPayload);
	return payload;
}
function propagateNotificationPayload(payload, messagePayloadInternal) {
	if (!messagePayloadInternal.notification) return;
	payload.notification = {};
	const title = messagePayloadInternal.notification.title;
	if (!!title) payload.notification.title = title;
	const body = messagePayloadInternal.notification.body;
	if (!!body) payload.notification.body = body;
	const image = messagePayloadInternal.notification.image;
	if (!!image) payload.notification.image = image;
	const icon = messagePayloadInternal.notification.icon;
	if (!!icon) payload.notification.icon = icon;
}
function propagateDataPayload(payload, messagePayloadInternal) {
	if (!messagePayloadInternal.data) return;
	payload.data = messagePayloadInternal.data;
}
function propagateFcmOptions(payload, messagePayloadInternal) {
	if (!messagePayloadInternal.fcmOptions && !messagePayloadInternal.notification?.click_action) return;
	payload.fcmOptions = {};
	const link = messagePayloadInternal.fcmOptions?.link ?? messagePayloadInternal.notification?.click_action;
	if (!!link) payload.fcmOptions.link = link;
	const analyticsLabel = messagePayloadInternal.fcmOptions?.analytics_label;
	if (!!analyticsLabel) payload.fcmOptions.analyticsLabel = analyticsLabel;
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
function isConsoleMessage(data) {
	return typeof data === "object" && !!data && CONSOLE_CAMPAIGN_ID in data;
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
_mergeStrings("AzSCbw63g1R0nCw85jG8", "Iaya3yLKwmgvh7cF0q4");
function _mergeStrings(s1, s2) {
	const resultArray = [];
	for (let i = 0; i < s1.length; i++) {
		resultArray.push(s1.charAt(i));
		if (i < s2.length) resultArray.push(s2.charAt(i));
	}
	return resultArray.join("");
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
	if (!app || !app.options) throw getMissingValueError("App Configuration Object");
	if (!app.name) throw getMissingValueError("App Name");
	const configKeys = [
		"projectId",
		"apiKey",
		"appId",
		"messagingSenderId"
	];
	const { options } = app;
	for (const keyName of configKeys) if (!options[keyName]) throw getMissingValueError(keyName);
	return {
		appName: app.name,
		projectId: options.projectId,
		apiKey: options.apiKey,
		appId: options.appId,
		senderId: options.messagingSenderId
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
var MessagingService = class {
	constructor(app, installations, analyticsProvider) {
		this.deliveryMetricsExportedToBigQueryEnabled = false;
		this.onBackgroundMessageHandler = null;
		this.onMessageHandler = null;
		this.logEvents = [];
		this.isLogServiceStarted = false;
		const appConfig = extractAppConfig(app);
		this.firebaseDependencies = {
			app,
			appConfig,
			installations,
			analyticsProvider
		};
	}
	_delete() {
		return Promise.resolve();
	}
};
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
async function registerDefaultSw(messaging) {
	try {
		messaging.swRegistration = await navigator.serviceWorker.register(DEFAULT_SW_PATH, { scope: DEFAULT_SW_SCOPE });
		messaging.swRegistration.update().catch(() => {});
		await waitForRegistrationActive(messaging.swRegistration);
	} catch (e) {
		throw ERROR_FACTORY.create("failed-service-worker-registration", { browserErrorMessage: e?.message });
	}
}
/**
* Waits for registration to become active. MDN documentation claims that
* a service worker registration should be ready to use after awaiting
* navigator.serviceWorker.register() but that doesn't seem to be the case in
* practice, causing the SDK to throw errors when calling
* swRegistration.pushManager.subscribe() too soon after register(). The only
* solution seems to be waiting for the service worker registration `state`
* to become "active".
*/
async function waitForRegistrationActive(registration) {
	return new Promise((resolve, reject) => {
		const rejectTimeout = setTimeout(() => reject(/* @__PURE__ */ new Error(`Service worker not registered after ${DEFAULT_REGISTRATION_TIMEOUT} ms`)), DEFAULT_REGISTRATION_TIMEOUT);
		const incomingSw = registration.installing || registration.waiting;
		if (registration.active) {
			clearTimeout(rejectTimeout);
			resolve();
		} else if (incomingSw) incomingSw.onstatechange = (ev) => {
			if (ev.target?.state === "activated") {
				incomingSw.onstatechange = null;
				clearTimeout(rejectTimeout);
				resolve();
			}
		};
		else {
			clearTimeout(rejectTimeout);
			reject(/* @__PURE__ */ new Error("No incoming service worker found."));
		}
	});
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
async function updateSwReg(messaging, swRegistration) {
	if (!swRegistration && !messaging.swRegistration) await registerDefaultSw(messaging);
	if (!swRegistration && !!messaging.swRegistration) return;
	if (!(swRegistration instanceof ServiceWorkerRegistration)) throw ERROR_FACTORY.create("invalid-sw-registration");
	messaging.swRegistration = swRegistration;
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
async function updateVapidKey(messaging, vapidKey) {
	if (!!vapidKey) messaging.vapidKey = vapidKey;
	else if (!messaging.vapidKey) messaging.vapidKey = DEFAULT_VAPID_KEY;
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
async function getToken$1(messaging, options) {
	if (!navigator) throw ERROR_FACTORY.create("only-available-in-window");
	if (Notification.permission === "default") await Notification.requestPermission();
	if (Notification.permission !== "granted") throw ERROR_FACTORY.create("permission-blocked");
	await updateVapidKey(messaging, options?.vapidKey);
	await updateSwReg(messaging, options?.serviceWorkerRegistration);
	return getTokenInternal(messaging);
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
async function logToScion(messaging, messageType, data) {
	const eventType = getEventType(messageType);
	(await messaging.firebaseDependencies.analyticsProvider.get()).logEvent(eventType, {
		message_id: data[CONSOLE_CAMPAIGN_ID],
		message_name: data[CONSOLE_CAMPAIGN_NAME],
		message_time: data[CONSOLE_CAMPAIGN_TIME],
		message_device_time: Math.floor(Date.now() / 1e3)
	});
}
function getEventType(messageType) {
	switch (messageType) {
		case MessageType.NOTIFICATION_CLICKED: return "notification_open";
		case MessageType.PUSH_RECEIVED: return "notification_foreground";
		default: throw new Error();
	}
}
/**
* @license
* Copyright 2017 Google LLC
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
async function messageEventListener(messaging, event) {
	const internalPayload = event.data;
	if (!internalPayload.isFirebaseMessaging) return;
	if (messaging.onMessageHandler && internalPayload.messageType === MessageType.PUSH_RECEIVED) if (typeof messaging.onMessageHandler === "function") messaging.onMessageHandler(externalizePayload(internalPayload));
	else messaging.onMessageHandler.next(externalizePayload(internalPayload));
	const dataPayload = internalPayload.data;
	if (isConsoleMessage(dataPayload) && dataPayload[CONSOLE_CAMPAIGN_ANALYTICS_ENABLED] === "1") await logToScion(messaging, internalPayload.messageType, dataPayload);
}
var name = "@firebase/messaging";
var version = "0.12.25";
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
var WindowMessagingFactory = (container) => {
	const messaging = new MessagingService(container.getProvider("app").getImmediate(), container.getProvider("installations-internal").getImmediate(), container.getProvider("analytics-internal"));
	navigator.serviceWorker.addEventListener("message", (e) => messageEventListener(messaging, e));
	return messaging;
};
var WindowMessagingInternalFactory = (container) => {
	const messaging = container.getProvider("messaging").getImmediate();
	return { getToken: (options) => getToken$1(messaging, options) };
};
function registerMessagingInWindow() {
	_registerComponent(new Component("messaging", WindowMessagingFactory, "PUBLIC"));
	_registerComponent(new Component("messaging-internal", WindowMessagingInternalFactory, "PRIVATE"));
	registerVersion(name, version);
	registerVersion(name, version, "esm2020");
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
/**
* Checks if all required APIs exist in the browser.
* @returns a Promise that resolves to a boolean.
*
* @public
*/
async function isWindowSupported() {
	try {
		await validateIndexedDBOpenable();
	} catch (e) {
		return false;
	}
	return typeof window !== "undefined" && isIndexedDBAvailable() && areCookiesEnabled() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && "fetch" in window && ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification") && PushSubscription.prototype.hasOwnProperty("getKey");
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
async function deleteToken$1(messaging) {
	if (!navigator) throw ERROR_FACTORY.create("only-available-in-window");
	if (!messaging.swRegistration) await registerDefaultSw(messaging);
	return deleteTokenInternal(messaging);
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
function onMessage$1(messaging, nextOrObserver) {
	if (!navigator) throw ERROR_FACTORY.create("only-available-in-window");
	messaging.onMessageHandler = nextOrObserver;
	return () => {
		messaging.onMessageHandler = null;
	};
}
/**
* @license
* Copyright 2017 Google LLC
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
* Retrieves a Firebase Cloud Messaging instance.
*
* @returns The Firebase Cloud Messaging instance associated with the provided firebase app.
*
* @public
*/
function getMessagingInWindow(app = getApp()) {
	isWindowSupported().then((isSupported) => {
		if (!isSupported) throw ERROR_FACTORY.create("unsupported-browser");
	}, (_) => {
		throw ERROR_FACTORY.create("indexed-db-unsupported");
	});
	return _getProvider(getModularInstance(app), "messaging").getImmediate();
}
/**
* Subscribes the {@link Messaging} instance to push notifications. Returns a Firebase Cloud
* Messaging registration token that can be used to send push messages to that {@link Messaging}
* instance.
*
* If notification permission isn't already granted, this method asks the user for permission. The
* returned promise rejects if the user does not allow the app to show notifications.
*
* @param messaging - The {@link Messaging} instance.
* @param options - Provides an optional vapid key and an optional service worker registration.
*
* @returns The promise resolves with an FCM registration token.
*
* @public
*/
async function getToken(messaging, options) {
	messaging = getModularInstance(messaging);
	return getToken$1(messaging, options);
}
/**
* Deletes the registration token associated with this {@link Messaging} instance and unsubscribes
* the {@link Messaging} instance from the push subscription.
*
* @param messaging - The {@link Messaging} instance.
*
* @returns The promise resolves when the token has been successfully deleted.
*
* @public
*/
function deleteToken(messaging) {
	messaging = getModularInstance(messaging);
	return deleteToken$1(messaging);
}
/**
* When a push message is received and the user is currently on a page for your origin, the
* message is passed to the page and an `onMessage()` event is dispatched with the payload of
* the push message.
*
*
* @param messaging - The {@link Messaging} instance.
* @param nextOrObserver - This function, or observer object with `next` defined,
*     is called when a message is received and the user is currently viewing your page.
* @returns To stop listening for messages execute this returned function.
*
* @public
*/
function onMessage(messaging, nextOrObserver) {
	messaging = getModularInstance(messaging);
	return onMessage$1(messaging, nextOrObserver);
}
/**
* The Firebase Cloud Messaging Web SDK.
* This SDK does not work in a Node.js environment.
*
* @packageDocumentation
*/
registerMessagingInWindow();
//#endregion
export { deleteToken, getMessagingInWindow as getMessaging, getToken, isWindowSupported as isSupported, onMessage };

//# sourceMappingURL=firebase_messaging.js.map