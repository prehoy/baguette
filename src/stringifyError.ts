import processError from "./processError";

export default function stringifyError(e: unknown) {
  return JSON.stringify(processError(e));
}
