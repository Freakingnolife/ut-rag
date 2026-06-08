import robotsParser from "robots-parser";

export const USER_AGENT = "UnionTechRAGBot";

export function makeRobots(robotsUrl: string, body: string) {
  const robots = robotsParser(robotsUrl, body);
  return {
    allowed(url: string, ua: string = USER_AGENT): boolean {
      return robots.isAllowed(url, ua) ?? true;
    },
    crawlDelay(ua: string = USER_AGENT): number {
      return robots.getCrawlDelay(ua) ?? 0;
    },
  };
}
