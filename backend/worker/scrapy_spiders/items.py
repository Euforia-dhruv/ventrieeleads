"""Scrapy items for lead generation."""
import scrapy


class BusinessItem(scrapy.Item):
    """A business lead discovered from web crawling."""
    name = scrapy.Field()
    url = scrapy.Field()
    phone = scrapy.Field()
    email = scrapy.Field()
    address = scrapy.Field()
    city = scrapy.Field()
    country = scrapy.Field()
    industry = scrapy.Field()
    rating = scrapy.Field()
    review_count = scrapy.Field()
    description = scrapy.Field()
    logo_url = scrapy.Field()
    social_links = scrapy.Field()
    source = scrapy.Field()
    source_url = scrapy.Field()
