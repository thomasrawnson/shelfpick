require "minitest/autorun"
require_relative "../bundle_flags"

class BundleFlagsTest < Minitest::Test
  LINKS = "#{BundleFlags::PRIVACY_URL} #{BundleFlags::TERMS_URL}".freeze

  def test_matching_off_and_on_builds_pass
    assert_empty BundleFlags.problems("a shelfpick-purchases-off #{LINKS}", purchases: false)
    assert_empty BundleFlags.problems("a shelfpick-purchases-on #{LINKS}", purchases: true)
  end

  def test_a_bad_flag_fails_in_both_directions
    on_requested = BundleFlags.problems("shelfpick-purchases-off #{LINKS}", purchases: true)
    assert_equal ["purchases requested ON but the bundle is built OFF"], on_requested
    off_requested = BundleFlags.problems("shelfpick-purchases-on #{LINKS}", purchases: false)
    assert_equal ["purchases requested OFF but the bundle is built ON"], off_requested
  end

  def test_a_bundle_with_both_markers_or_none_fails
    both = BundleFlags.problems("shelfpick-purchases-on shelfpick-purchases-off #{LINKS}", purchases: true)
    assert_match(/built ON\/OFF/, both.first)
    none = BundleFlags.problems(LINKS, purchases: false)
    assert_match(/no purchases marker/, none.first)
  end

  def test_missing_legal_links_fail_even_when_purchases_are_off
    problems = BundleFlags.problems("shelfpick-purchases-off", purchases: false)
    assert_equal 2, problems.size
    assert_match(/Privacy Policy/, problems[0])
    assert_match(/Terms of Use/, problems[1])
  end
end
