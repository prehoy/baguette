// Normalizes anything thrown (Error / axios error / string / junk) into one flat
// shape so logs and 500 bodies are consistent regardless of the source.
export default function processError(e: any) {
  if (e?.response?.data) {
    return {
      error_message: e.message,
      response: e.response?.data,
      request: e.request?.body,
    };
  }
  if (e?.message) return { error_message: e.message };
  if (typeof e === "string") return { error_message: e };
  return { error_message: "Could not process error" };
}
