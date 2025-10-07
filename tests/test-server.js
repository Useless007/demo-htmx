// Small helper to start/stop the app server for tests.
export async function startTestServer(port = 3011) {
    // import the app module which exports startServer/stopServer
    const app = await import('../index.js');
    app.startServer(port);
    return app; // return module so caller can stop via app.stopServer()
}

export async function stopTestServer(appModule) {
    try {
        if (appModule && typeof appModule.stopServer === 'function') {
            appModule.stopServer();
        }
    } catch (e) { /* ignore */ }
}
