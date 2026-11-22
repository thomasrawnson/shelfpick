# Checks the web bundle inside an archived IPA (SP-STORE-R02). Plain Ruby so it can run and be
# tested without fastlane:
#   ruby fastlane/bundle_flags.rb <dir with the built .js files> on|off
#   ruby fastlane/test/bundle_flags_test.rb
#
# The bundle carries two compiled-in facts. frontend/src/purchases-flag.ts folds to exactly one
# of the markers below, so the effective purchase state is read back from the archive rather
# than trusted from the flag that was requested. The Privacy Policy and Terms URLs are
# compiled in by the code that links them from Settings and the paywall.
module BundleFlags
  PRIVACY_URL = "https://plutonightlabs.com/shelfpick/privacy/".freeze
  TERMS_URL = "https://plutonightlabs.com/shelfpick/terms/".freeze
  MARKER = /shelfpick-purchases-(on|off)/.freeze

  # Returns the list of problems; empty means the bundle matches what was requested.
  def self.problems(js, purchases:)
    wanted = purchases ? "on" : "off"
    found = js.scan(MARKER).flatten.uniq
    problems = []
    if found.empty?
      problems << "the bundle has no purchases marker, so its effective purchase state cannot be checked"
    elsif found != [wanted]
      problems << "purchases requested #{wanted.upcase} but the bundle is built #{found.map(&:upcase).join('/')}"
    end
    problems << "the bundle has no Privacy Policy link (#{PRIVACY_URL})" unless js.include?(PRIVACY_URL)
    problems << "the bundle has no Terms of Use link (#{TERMS_URL})" unless js.include?(TERMS_URL)
    problems
  end

  def self.web_js(dir)
    Dir[File.join(dir, "**/*.js")].map { |file| File.read(file, encoding: "UTF-8").scrub }.join("\n")
  end
end

if $PROGRAM_NAME == __FILE__
  dir, state = ARGV
  abort("usage: ruby fastlane/bundle_flags.rb <dir> on|off") unless dir && %w[on off].include?(state)
  found = BundleFlags.problems(BundleFlags.web_js(dir), purchases: state == "on")
  if found.empty?
    puts "Bundle checks passed: purchases #{state.upcase}, Privacy Policy and Terms links present"
  else
    found.each { |problem| warn("FAIL: #{problem}") }
    exit 1
  end
end
