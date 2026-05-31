export interface MetadataConfig {
  title: string;
  description: string;
  socialTitle?: string;
  socialDescription?: string;
  twitterTitle?: string;
  path?: string;
  keywords?: string[];
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: "website" | "article" | "profile";
  noSuffix?: boolean;
  noIndex?: boolean;
}
