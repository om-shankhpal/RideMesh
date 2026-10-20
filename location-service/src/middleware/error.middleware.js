export function errorHandler(err, req, res, next) {
    console.error("Request failed:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        error: "Internal server error",
    });
}