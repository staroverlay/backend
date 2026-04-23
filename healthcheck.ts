const PORT = process.env.PORT || 3000;

try {
    const response = await fetch(`http://localhost:${PORT}/health`);
    if (response.ok) {
        process.exit(0);
    } else {
        console.error(`Health check failed with status: ${response.status}`);
        process.exit(1);
    }
} catch (error) {
    console.error("Health check failed:", error);
    process.exit(1);
}
