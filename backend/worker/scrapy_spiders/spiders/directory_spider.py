"""Business directory spider — crawls Clutch, GoodFirms, etc. for agency leads."""
import scrapy
from urllib.parse import urljoin


class BusinessDirectorySpider(scrapy.Spider):
    """Crawl business directories to find potential clients.

    Usage:
        scrapy crawl directory -a category="web-design" -a city="dubai"
    """
    name = "directory"
    allowed_domains = ["clutch.co", "goodfirms.co", "designrush.com"]

    def __init__(self, category="web-design", city="dubai", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.category = category
        self.city = city
        self.start_urls = [
            f"https://clutch.co/{self.city}/{self.category}",
            f"https://goodfirms.co/{self.category}/{self.city}",
        ]

    def parse(self, response):
        """Parse directory listing pages."""
        # Clutch.co selectors
        for company in response.css(".provider"):
            item = {
                "name": company.css(".company_name a::text").get("").strip(),
                "url": company.css(".website a::attr(href)").get(""),
                "rating": company.css(".rating::text").get("").strip(),
                "review_count": company.css(".reviews_count::text").get("").strip(),
                "city": self.city,
                "industry": self.category,
                "source": response.url.split("/")[2],
                "source_url": response.url,
            }

            if item["name"]:
                yield response.follow(
                    company.css(".company_name a::attr(href)").get(""),
                    callback=self.parse_company,
                    meta={"item": item},
                )

        # Follow pagination
        next_page = response.css("a.next::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    def parse_company(self, response):
        """Parse individual company page for contact details."""
        item = response.meta["item"]

        item["description"] = response.css(".company_description::text").get("").strip()
        item["phone"] = response.css(".phone::text").get("").strip()
        item["email"] = response.css(".email::text").get("").strip()
        item["address"] = response.css(".address::text").get("").strip()

        # Social links
        item["social_links"] = {}
        for link in response.css("a.social-link"):
            href = link.attrib.get("href", "")
            if "linkedin" in href:
                item["social_links"]["linkedin"] = href
            elif "twitter" in href or "x.com" in href:
                item["social_links"]["twitter"] = href
            elif "facebook" in href:
                item["social_links"]["facebook"] = href

        yield item
